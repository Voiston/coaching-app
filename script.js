// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // TON NUMÉRO
const PAST_DAYS = 3;   // Jours passés affichés dans le calendrier
const DAYS_AHEAD = 21; // Jours à venir affichés

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Variables Globales pour le multi-séances
let globalData = null;
let currentSessionId = "default";
let currentSessionDate = ""; // Date AAAA-MM-JJ de la séance affichée (pour "terminée")

document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

// --- VALIDATION JSON ---
function validateProgram(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: "Fichier programme invalide." };
    if (data.sessions && !Array.isArray(data.sessions)) return { ok: false, error: "Le champ 'sessions' doit être un tableau." };
    const sessions = data.sessions || (data.exercises ? [{ exercises: data.exercises }] : []);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (s.date && !dateRegex.test(s.date)) return { ok: false, error: `Date invalide dans la séance ${i + 1} : "${s.date}". Utilise le format AAAA-MM-JJ.` };
    }
    return { ok: true };
}

// --- SÉANCES TERMINÉES (localStorage) ---
const COMPLETED_KEY = 'fitapp_completed_' + clientID;
function getCompletedSessions() {
    try {
        return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');
    } catch { return []; }
}
function markSessionCompleted(sessionId, dateStr) {
    const list = getCompletedSessions();
    if (list.some(e => e.sessionId === sessionId && e.date === dateStr)) return;
    list.push({ sessionId, date: dateStr });
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(list));
}
function isSessionCompleted(sessionId, dateStr) {
    return getCompletedSessions().some(e => e.sessionId === sessionId && e.date === dateStr);
}

// --- CHARGEMENT INITIAL ---
fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'notfound' : 'fetch')))
    .then(data => {
        const validation = validateProgram(data);
        if (!validation.ok) {
            showLoadError(validation.error);
            return;
        }
        globalData = data;
        initApp(data);
    })
    .catch(err => {
        const msg = err.message === 'notfound' ? "Programme introuvable. Vérifie l'URL (?client=nom)." : "Impossible de charger le programme. Vérifie ta connexion.";
        showLoadError(msg);
    });

function showLoadError(message) {
    document.getElementById('client-name').textContent = "Erreur de chargement";
    document.getElementById('program-title').textContent = "";
    document.getElementById('workout-container').innerHTML = `<div class="error-message" role="alert"><p>${message}</p></div>`;
    document.getElementById('calendar-strip').innerHTML = "";
}

function initApp(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;

    // Si on a des sessions, on lance le calendrier
    if (data.sessions && data.sessions.length > 0) {
        renderCalendar(data.sessions);
    } else if (data.exercises) {
        // Rétro-compatibilité (Ancien format sans calendrier)
        globalData.sessions = [{ id: "unique", name: "Séance Unique", exercises: data.exercises }];
        renderSession(0); // On charge direct
    }
}

// --- CALENDRIER HYBRIDE (DATES RÉELLES & JOURS SEMAINE) ---
function renderCalendar(sessions) {
    const calendarContainer = document.getElementById('calendar-strip');
    calendarContainer.innerHTML = "";

    const today = new Date();
    const dayMap = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    let todayEl = null;

    for (let i = -PAST_DAYS; i <= DAYS_AHEAD; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);

        const dayIndex = date.getDay();
        const dayNameFR = dayMap[dayIndex];
        const dateNum = date.getDate();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const sessionIndex = sessions.findIndex(s => {
            if (s.date) return s.date === dateString;
            if (s.day) return s.day.toLowerCase() === dayNameFR;
            return false;
        });

        const hasSession = sessionIndex !== -1;
        const sId = hasSession ? (sessions[sessionIndex].id || `session_${sessionIndex}`) : null;
        const completed = hasSession && isSessionCompleted(sId, dateString);

        const dayEl = document.createElement('div');
        let classes = "calendar-day";
        if (hasSession) classes += " has-session";
        if (completed) classes += " is-completed";
        dayEl.className = classes;
        dayEl.setAttribute('role', 'button');
        dayEl.setAttribute('aria-label', hasSession ? `Séance du ${dayNameFR} ${dateNum}` : `Repos le ${dayNameFR} ${dateNum}`);
        dayEl.dataset.sessionIndex = hasSession ? String(sessionIndex) : '';
        dayEl.dataset.dateString = dateString;
        dayEl.dataset.dayName = dayNameFR + " " + dateNum;
        dayEl.dataset.isToday = (i === 0) ? '1' : '0';

        dayEl.innerHTML = `
            <span class="day-name">${dayNameFR.substring(0, 3).toUpperCase()}</span>
            <span class="day-date">${dateNum}</span>
        `;

        dayEl.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
            dayEl.classList.add('active');
            if (hasSession) renderSession(sessionIndex, dateString);
            else showRestDay(dayNameFR + " " + dateNum);
        });

        if (i === 0) todayEl = dayEl;
        calendarContainer.appendChild(dayEl);
    }

    if (todayEl) setTimeout(() => todayEl.click(), 50);
}

function showRestDay(dayName) {
    const container = document.getElementById('workout-container');
    container.innerHTML = `
        <div class="rest-day-message">
            <span class="rest-icon">🧘‍♀️</span>
            <h2>Repos ce ${dayName}</h2>
            <p>Profite-en pour récupérer, bien manger et dormir.</p>
            <p style="font-size:0.9rem; margin-top:20px; color:var(--primary)">Patience, la prochaine séance arrive !</p>
        </div>
    `;
    document.getElementById('progress-bar').style.width = "0%";
}

// --- MOTEUR D'AFFICHAGE DE SÉANCE ---
function renderSession(sessionIndex, dateStr) {
    const session = globalData.sessions[sessionIndex];
    const container = document.getElementById('workout-container');

    currentSessionId = session.id || `session_${sessionIndex}`;
    currentSessionDate = dateStr || (session.date || "");

    container.innerHTML = "";
    document.getElementById('progress-bar').style.width = "0%";

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'reset-session-btn';
    resetBtn.setAttribute('data-reset-session', '1');
    resetBtn.setAttribute('aria-label', 'Recommencer la séance et décocher toutes les séries');
    resetBtn.textContent = "↺ Recommencer la séance";
    container.appendChild(resetBtn);

    let currentSupersetContainer = null;

    session.exercises.forEach((exo, index) => {
        if (exo.type === "section") {
            if (currentSupersetContainer) { container.appendChild(currentSupersetContainer); currentSupersetContainer = null; }
            container.insertAdjacentHTML('beforeend', `<h2 class="section-title">${exo.title}</h2>`);
            return; 
        }

        if (exo.superset_type === "start") {
            currentSupersetContainer = document.createElement('div');
            currentSupersetContainer.className = "superset-row";
        }

        const cardHtml = createExerciseCard(exo, index, currentSessionId);
        
        if (currentSupersetContainer) {
            currentSupersetContainer.innerHTML += cardHtml;
            if (exo.superset_type === "end") {
                container.appendChild(currentSupersetContainer);
                currentSupersetContainer = null;
            }
        } else {
            container.insertAdjacentHTML('beforeend', cardHtml);
        }
    });
    if (currentSupersetContainer) container.appendChild(currentSupersetContainer);

    // Initialisation des hauteurs pour l'animation accordéon
    setTimeout(() => {
        document.querySelectorAll('.exercise-card.open .exercise-content').forEach(content => {
            content.style.maxHeight = content.scrollHeight + "px";
        });
    }, 100);

    // CHARGEMENT DES DONNÉES SAUVEGARDÉES
    loadProgress();
}

function createExerciseCard(exo, index, sessionId) {
    let mediaHtml = '';
    if (exo.image && (exo.image.includes('youtube') || exo.image.includes('youtu.be'))) {
        mediaHtml = `<a href="${exo.image}" target="_blank" class="video-btn">▶ Voir la démo vidéo</a>`;
    } else if (exo.image) {
        mediaHtml = `<img src="${exo.image}" class="exercise-img show" loading="lazy">`;
    }

    let setsCount = parseInt(exo.sets) || 3;
    let checkboxesHtml = '<div class="sets-container">';
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check text-white" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;

    for (let i = 1; i <= setsCount; i++) {
        checkboxesHtml += `<div>
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" data-card-index="${index}" data-set-num="${i}" data-total-sets="${setsCount}" aria-label="Série ${i} sur ${setsCount}">
            <label for="set-${index}-${i}" class="set-label">
                ${i}
                ${checkIcon}
            </label>
        </div>`;
    }
    checkboxesHtml += '</div>';

    // CONSTRUCTION DES IDs UNIQUES
    const idCharge = `charge-${sessionId}-${index}`;
    const idRpe = `rpe-${sessionId}-${index}`;
    const idCom = `comment-${sessionId}-${index}`;

    const restSec = parseInt(String(exo.rest).replace(/\D/g, ''), 10) || 60;
    return `
    <div class="exercise-card open" id="card-${index}" data-index="${index}">
        <div class="exercise-header" role="button" tabindex="0" aria-expanded="true" aria-label="Afficher ou masquer les détails de l'exercice">
            <div>
                <div class="exercise-title">${exo.name}</div>
                <div class="rpe-badge">RPE: ${exo.rpe_target || '-'}</div>
            </div>
            <div class="toggle-icon">▼</div>
        </div>
        
        <div class="exercise-content">
            <div class="exercise-inner">
                ${mediaHtml}
                <div class="details-grid">
                    <div class="detail-box"><span class="detail-label">Séries</span><span class="detail-value">${exo.sets}</span></div>
                    <div class="detail-box"><span class="detail-label">Reps</span><span class="detail-value">${exo.reps}</span></div>
                    <div class="detail-box"><span class="detail-label">Repos</span><span class="detail-value">${exo.rest}</span></div>
                    <button type="button" class="timer-btn" data-rest="${restSec}" aria-label="Lancer le chronomètre de repos de ${exo.rest}">
                        <span class="timer-icon">⏱️</span><span class="timer-text">Lancer le repos</span>
                    </button>
                </div>
                ${checkboxesHtml}
                ${exo.note_coach ? `<div class="coach-note">💡 "${exo.note_coach}"</div>` : ''}
                <div class="client-input-zone">
                    <div class="input-row">
                        <input type="text" id="${idCharge}" placeholder="Charge (kg)" aria-label="Charge en kg">
                        <input type="number" id="${idRpe}" placeholder="RPE" min="1" max="10" aria-label="RPE ressenti">
                    </div>
                    <input type="text" id="${idCom}" placeholder="Note..." aria-label="Note personnelle">
                </div>
            </div>
        </div>
    </div>`;
}

function checkSetAndCollapse(checkbox, cardIndex, setNumber, totalSets) {
    updateProgress(true); 
    saveData(); 

    if (checkbox.checked && setNumber === totalSets) {
        const card = document.getElementById(`card-${cardIndex}`);
        if (card && card.classList.contains('open')) {
            setTimeout(() => { 
                const header = card.querySelector('.exercise-header');
                if(header) toggleCard(header); 
            }, 300);
        }
    }
}

function toggleCard(header) {
    const card = header.parentElement;
    const content = card.querySelector('.exercise-content');
    if (card.classList.contains('open')) {
        card.classList.remove('open');
        content.style.maxHeight = null;
    } else {
        card.classList.add('open');
        content.style.maxHeight = content.scrollHeight + "px";
    }
}

function saveAndProgress() {
    saveData();
}

function updateProgress(shouldOpenModal = false) {
    const total = document.querySelectorAll('.set-checkbox').length;
    const checked = document.querySelectorAll('.set-checkbox:checked').length;
    const percent = (total === 0) ? 0 : (checked / total) * 100;
    
    document.getElementById('progress-bar').style.width = percent + "%";

    if (percent === 100 && shouldOpenModal) {
        if (currentSessionDate) markSessionCompleted(currentSessionId, currentSessionDate);
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        if (whatsappBtn) document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        setupModalFocusTrap();
        document.addEventListener('keydown', handleModalEscape);
    }
}

function saveData() {
    const dataToSave = {};
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        if(input.id && !input.id.startsWith('score-') && !input.id.startsWith('com-')) {
            dataToSave[input.id] = input.value;
        }
    });

    const existingData = JSON.parse(localStorage.getItem('fitapp_' + clientID) || '{}');
    const newData = { ...existingData, ...dataToSave };

    localStorage.setItem('fitapp_' + clientID, JSON.stringify(newData));
}

function loadProgress() {
    const saved = localStorage.getItem('fitapp_' + clientID);
    if (!saved) return;
    const data = JSON.parse(saved);
    
    for (const [id, value] of Object.entries(data)) {
        const el = document.getElementById(id);
        if (el && el.type !== 'checkbox') {
            el.value = value;
        }
    }
    updateProgress(false);
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
}

function startTimer(btn, seconds) {
    if (btn.classList.contains('active')) return;
    let timeLeft = seconds;
    btn.classList.add('active');
    const timerText = btn.querySelector('.timer-text');
    timerText.textContent = `Repos : ${timeLeft}s`;
    const interval = setInterval(() => {
        timeLeft--;
        timerText.textContent = `Repos : ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            btn.classList.remove('active');
            timerText.textContent = "Terminé !";
            playBeep();
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
}

function sendToWhatsapp() {
    let msg = `*Rapport Final - ${document.getElementById('client-name').innerText}*\n`;
    
    // Récupérer le nom de la séance active (depuis le JSON via l'ID global)
    // On doit retrouver la séance actuelle dans globalData
    let sessionName = "Séance";
    if (globalData && globalData.sessions) {
        const currentSession = globalData.sessions.find(s => (s.id === currentSessionId) || (`session_${globalData.sessions.indexOf(s)}` === currentSessionId));
        if (currentSession) sessionName = currentSession.name;
    }

    msg += `📂 *${sessionName}*\n\n`;

    document.querySelectorAll('.exercise-card').forEach((card) => {
        const originalIndex = card.dataset.index;
        const title = card.querySelector('.exercise-title').innerText;
        
        const idCharge = `charge-${currentSessionId}-${originalIndex}`;
        const idRpe = `rpe-${currentSessionId}-${originalIndex}`;
        const idCom = `comment-${currentSessionId}-${originalIndex}`;

        const load = document.getElementById(idCharge)?.value;
        const rpe = document.getElementById(idRpe)?.value;
        const note = document.getElementById(idCom)?.value;
        
        if(load || rpe || note) {
            msg += `🔹 *${title}*\n`;
            if(load) msg += `   ⚖️ ${load}kg\n`;
            if(rpe)  msg += `   🔥 RPE ${rpe}\n`;
            if(note) msg += `   📝 ${note}\n`;
        }
    });

    const sMuscle = document.getElementById('score-muscle').value; // range ou number
    const cMuscle = document.getElementById('com-muscle').value;
    const sCardio = document.getElementById('score-cardio').value;
    const cCardio = document.getElementById('com-cardio').value;
    const sFatigue = document.getElementById('score-fatigue').value;
    const cFatigue = document.getElementById('com-fatigue').value;
    const sSleep = document.getElementById('score-sleep').value;
    const cSleep = document.getElementById('com-sleep').value;

    if (sMuscle || sCardio || sFatigue || sSleep) {
        msg += `\n📊 *BILAN GLOBAL*\n`;
        if(sMuscle) msg += `💪 Muscle: ${sMuscle}/10 ${cMuscle ? '('+cMuscle+')' : ''}\n`;
        if(sCardio) msg += `🫀 Cardio: ${sCardio}/10 ${cCardio ? '('+cCardio+')' : ''}\n`;
        if(sFatigue) msg += `😫 Fatigue: ${sFatigue}/10 ${cFatigue ? '('+cFatigue+')' : ''}\n`;
        if(sSleep)  msg += `💤 Sommeil: ${sSleep}/10 ${cSleep ? '('+cSleep+')' : ''}\n`;
    }

    msg += `\nEnvoyé depuis mon App Coaching 🏋️‍♀️`;
    
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

let modalPreviousFocus = null;

function setupModalFocusTrap() {
    const modal = document.querySelector('.completion-modal');
    if (!modal) return;
    modalPreviousFocus = document.activeElement;
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    if (first) first.focus();
    modal.addEventListener('keydown', trapTab);
    function trapTab(e) {
        if (e.key !== 'Tab') return;
        const f = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstEl = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        } else {
            if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
        }
    }
    modal._trapTab = trapTab;
}

function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleModalEscape);
    }
}

function refreshCalendarCompletedState() {
    if (!globalData || !globalData.sessions) return;
    document.querySelectorAll('.calendar-day.has-session').forEach(dayEl => {
        const sessionIndex = parseInt(dayEl.dataset.sessionIndex, 10);
        const dateString = dayEl.dataset.dateString;
        if (isNaN(sessionIndex) || !dateString) return;
        const s = globalData.sessions[sessionIndex];
        const sId = s ? (s.id || `session_${sessionIndex}`) : null;
        if (sId && isSessionCompleted(sId, dateString)) dayEl.classList.add('is-completed');
        else dayEl.classList.remove('is-completed');
    });
}

function closeModal() {
    document.body.classList.remove('modal-open');
    const overlay = document.getElementById('completion-overlay');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleModalEscape);
    const modal = document.querySelector('.completion-modal');
    if (modal && modal._trapTab) modal.removeEventListener('keydown', modal._trapTab);
    const whatsappBtn = document.querySelector('#modal-btn-container button');
    if (whatsappBtn) document.querySelector('.whatsapp-sticky').appendChild(whatsappBtn);
    if (modalPreviousFocus && typeof modalPreviousFocus.focus === 'function') modalPreviousFocus.focus();
    refreshCalendarCompletedState();
}

function resetCurrentSession() {
    const container = document.getElementById('workout-container');
    if (!container) return;
    container.querySelectorAll('.set-checkbox').forEach(cb => { cb.checked = false; });
    document.getElementById('progress-bar').style.width = "0%";
}

// --- DÉLÉGATION D'ÉVÉNEMENTS (remplace les onclick inline) ---
document.body.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) { closeModal(); return; }
    if (e.target.closest('.whatsapp-sticky button')) { sendToWhatsapp(); return; }
    if (e.target.closest('[data-reset-session]')) { resetCurrentSession(); return; }
    const header = e.target.closest('.exercise-header');
    if (header) { toggleCard(header); return; }
    const timerBtn = e.target.closest('.timer-btn');
    if (timerBtn && timerBtn.dataset.rest !== undefined) {
        startTimer(timerBtn, parseInt(timerBtn.dataset.rest, 10) || 60);
    }
});
document.body.addEventListener('keydown', (e) => {
    if (e.target.closest('.close-modal') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        closeModal();
        return;
    }
    const header = e.target.closest('.exercise-header');
    if (header && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggleCard(header);
    }
});
document.getElementById('workout-container').addEventListener('change', (e) => {
    if (!e.target.classList.contains('set-checkbox')) return;
    const cardIndex = parseInt(e.target.dataset.cardIndex, 10);
    const setNum = parseInt(e.target.dataset.setNum, 10);
    const totalSets = parseInt(e.target.dataset.totalSets, 10);
    checkSetAndCollapse(e.target, cardIndex, setNum, totalSets);
});
document.getElementById('workout-container').addEventListener('input', (e) => {
    if (e.target.matches('input[id^="charge-"], input[id^="rpe-"], input[id^="comment-"]')) saveAndProgress();
});
document.body.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-slider')) {
        const span = document.querySelector('.score-value[data-for="' + e.target.id + '"]');
        if (span) span.textContent = e.target.value;
    }
});