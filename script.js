// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // TON NUMÉRO
const COACH_NAME = "David";
const APP_VERSION = "2.2";
const PAST_DAYS = 3;
const DAYS_AHEAD = 21;

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

let globalData = null;
let currentSessionId = "default";
let currentSessionDate = "";

// --- PARAMÈTRES (localStorage) ---
const KEY_SOUND = 'fitapp_sound_' + clientID;
const KEY_THEME = 'fitapp_theme_' + clientID;
const KEY_COACH_NOTE = 'fitapp_coach_note_' + clientID;
const KEY_NOTIF_DAY = 'fitapp_notif_day_' + clientID;
const KEY_NOTIF_ENABLED = 'fitapp_notif_enabled_' + clientID;

function getSettingSound() { return localStorage.getItem(KEY_SOUND) !== '0'; }
function setSettingSound(on) { localStorage.setItem(KEY_SOUND, on ? '1' : '0'); }
function getSettingTheme() { return localStorage.getItem(KEY_THEME) || 'light'; }
function setSettingTheme(v) { localStorage.setItem(KEY_THEME, v); }
function getCoachNote() { return localStorage.getItem(KEY_COACH_NOTE) || ''; }
function setCoachNote(t) { localStorage.setItem(KEY_COACH_NOTE, (t || '').trim()); }
function isNotificationEnabled() { return localStorage.getItem(KEY_NOTIF_ENABLED) === '1'; }
function setNotificationEnabled(on) { localStorage.setItem(KEY_NOTIF_ENABLED, on ? '1' : '0'); }
function getLastNotifDate() { return localStorage.getItem(KEY_NOTIF_DAY) || ''; }
function setLastNotifDate(d) { localStorage.setItem(KEY_NOTIF_DAY, d); }

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
        const msg = err.message === 'notfound'
            ? "Ce programme n'est pas encore disponible. Ton coach te l'enverra très bientôt !"
            : "Impossible de charger le programme. Vérifie ta connexion et réessaie.";
        showLoadError(msg);
    });

function showLoadError(message) {
    document.getElementById('client-name').textContent = "Oups...";
    document.getElementById('program-title').textContent = "";
    document.getElementById('client-name').classList.remove('loading-skeleton');
    document.getElementById('program-title').classList.remove('loading-skeleton');
    document.getElementById('workout-container').innerHTML = `<div class="error-message" role="alert"><p>${message}</p></div>`;
    document.getElementById('calendar-strip').innerHTML = "";
    const wrap = document.getElementById('calendar-wrap');
    if (wrap) wrap.classList.remove('collapsed');
    document.getElementById('week-context').innerHTML = "";
    document.getElementById('next-session').innerHTML = "";
    const goalEl = document.getElementById('weekly-goal-banner');
    if (goalEl) goalEl.innerHTML = "";
    const statsEl = document.getElementById('stats-bar');
    if (statsEl) statsEl.innerHTML = "";
    document.getElementById('coach-signature').innerHTML = "";
    const pan = document.getElementById('progression-panel');
    if (pan) { pan.innerHTML = ""; pan.hidden = true; }
    const btnProg = document.getElementById('btn-progression-toggle');
    if (btnProg) { btnProg.textContent = '📈 Ma progression'; btnProg.setAttribute('aria-expanded', 'false'); }
}

function initApp(data) {
    document.getElementById('client-name').classList.remove('loading-skeleton');
    document.getElementById('program-title').classList.remove('loading-skeleton');
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;

    if (data.sessions && data.sessions.length > 0) {
        renderCalendar(data.sessions);
        updateWeekAndNextSession(data.sessions);
    } else if (data.exercises) {
        globalData.sessions = [{ id: "unique", name: "Séance Unique", exercises: data.exercises }];
        renderSession(0);
        updateWeekAndNextSession(globalData.sessions);
    }
    renderCoachSignature();
    renderProgressionPanel();
    initFocusMode();
    initSettings();
    initPrintButton();
    initProgressionToggle();
    initOfflineBanner();
    maybeShowNotification(globalData && globalData.sessions ? globalData.sessions : []);
}

// --- SEMAINE & PROCHAINE SÉANCE ---
function getWeekLabel() {
    const d = new Date();
    const j = d.getDate(), m = d.getMonth();
    const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return `Semaine du ${j} ${mois[m]}`;
}

function getNextSessionInfo(sessions) {
    const today = new Date();
    const dayMap = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    for (let i = 1; i <= DAYS_AHEAD; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const y = date.getFullYear(), mo = String(date.getMonth() + 1).padStart(2, '0'), da = String(date.getDate()).padStart(2, '0');
        const dateString = `${y}-${mo}-${da}`;
        const idx = sessions.findIndex(s => s.date === dateString || (s.day && s.day.toLowerCase() === dayMap[date.getDay()]));
        if (idx !== -1) {
            const s = sessions[idx];
            const dayName = dayMap[date.getDay()];
            const shortName = (s.name || "Séance").replace(/^[\s\S]*?[\s:]/, "").trim() || s.name || "Séance";
            return { dayName, dateNum: date.getDate(), name: shortName, sessionIndex: idx, inDays: i };
        }
    }
    return null;
}

function getStats(sessions) {
    const completed = getCompletedSessions();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sessionsThisMonth = 0;
    const completedByWeek = {};
    completed.forEach(e => {
        if (e.date && e.date.startsWith(thisMonth)) sessionsThisMonth++;
        if (e.date) {
            const d = new Date(e.date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const key = weekStart.toISOString().slice(0, 10);
            completedByWeek[key] = (completedByWeek[key] || 0) + 1;
        }
    });
    const weekKeys = Object.keys(completedByWeek).sort();
    let streakWeeks = 0;
    const todayKey = new Date();
    todayKey.setDate(todayKey.getDate() - todayKey.getDay());
    const thisWeekKey = todayKey.toISOString().slice(0, 10);
    for (let i = weekKeys.indexOf(thisWeekKey) >= 0 ? weekKeys.indexOf(thisWeekKey) : weekKeys.length; i--; ) {
        if (completedByWeek[weekKeys[i]] > 0) streakWeeks++;
        else break;
    }
    const next = getNextSessionInfo(sessions);
    return { sessionsThisMonth, streakWeeks, nextInDays: next ? next.inDays : null };
}

function updateWeekAndNextSession(sessions) {
    const weekEl = document.getElementById('week-context');
    const nextEl = document.getElementById('next-session');
    const goalEl = document.getElementById('weekly-goal-banner');
    const statsEl = document.getElementById('stats-bar');
    if (weekEl) weekEl.textContent = getWeekLabel();
    const next = getNextSessionInfo(sessions);
    if (nextEl) {
        if (next) nextEl.innerHTML = `Prochaine séance : <strong>${next.dayName} ${next.dateNum}</strong> — ${next.name}`;
        else nextEl.innerHTML = "";
    }
    if (goalEl && globalData && globalData.weeklyGoal) {
        const completed = getCompletedSessions();
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0,0,0,0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        let thisWeekCount = 0;
        completed.forEach(e => {
            if (e.date) {
                const d = new Date(e.date);
                if (d >= weekStart && d < weekEnd) thisWeekCount++;
            }
        });
        const goal = globalData.weeklyGoal;
        goalEl.innerHTML = `Objectif semaine : ${thisWeekCount}/${goal} séance${goal > 1 ? 's' : ''}`;
        goalEl.classList.add('show');
    } else if (goalEl) goalEl.innerHTML = '';
    if (statsEl && sessions && sessions.length) {
        const st = getStats(sessions);
        let html = `<span>${st.sessionsThisMonth} séance${st.sessionsThisMonth !== 1 ? 's' : ''} ce mois</span>`;
        if (st.streakWeeks > 0) html += ` · <span>Série : ${st.streakWeeks} sem.</span>`;
        if (st.nextInDays != null) html += ` · <span>Prochaine dans ${st.nextInDays} j</span>`;
        statsEl.innerHTML = html;
    }
}

// --- CALENDRIER ---
function shortSessionName(name) {
    if (!name) return "";
    return name.replace(/^[^\w]*[\s:]/, "").trim().slice(0, 12) || name.slice(0, 12);
}

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
        const session = hasSession ? sessions[sessionIndex] : null;
        const sId = hasSession ? (session.id || `session_${sessionIndex}`) : null;
        const completed = hasSession && isSessionCompleted(sId, dateString);
        const sessionShortName = hasSession ? shortSessionName(session.name) : "";

        const dayEl = document.createElement('div');
        let classes = "calendar-day";
        if (hasSession) classes += " has-session";
        if (completed) classes += " is-completed";
        dayEl.className = classes;
        dayEl.setAttribute('role', 'button');
        dayEl.setAttribute('aria-label', hasSession ? `Séance du ${dayNameFR} ${dateNum} : ${sessionShortName || session.name}` : `Repos le ${dayNameFR} ${dateNum}`);
        dayEl.dataset.sessionIndex = hasSession ? String(sessionIndex) : '';
        dayEl.dataset.dateString = dateString;
        dayEl.dataset.dayName = dayNameFR + " " + dateNum;
        dayEl.dataset.isToday = (i === 0) ? '1' : '0';

        dayEl.innerHTML = `
            <span class="day-name">${dayNameFR.substring(0, 3).toUpperCase()}</span>
            <span class="day-date">${dateNum}</span>
            ${sessionShortName ? `<span class="day-session-name" title="${(session && session.name) || ''}">${sessionShortName}</span>` : ""}
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
            <span class="rest-icon" aria-hidden="true">🧘‍♀️</span>
            <h2>Jour de récup' — ${dayName}</h2>
            <p class="rest-lead">La récupération fait partie de la progression. Ton corps construit pendant le repos.</p>
            <p class="rest-tip">Hydrate-toi bien, mange équilibré et dors à ta soif. La prochaine séance t'attend ! 💪</p>
        </div>
    `;
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = "0%";
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

    loadProgress();
    renderProgressionPanel();
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

    const repsDisplay = (exo.until_failure || exo.failure) ? 'Jusqu\'à échec' : (exo.reps || '-');
    const tempoHtml = exo.tempo ? `<div class="detail-box"><span class="detail-label">Tempo</span><span class="detail-value">${exo.tempo}</span></div>` : '';
    const variationHtml = exo.variation ? `<div class="exercise-variation">Variante : ${exo.variation}</div>` : '';
    const gridClass = exo.tempo ? 'details-grid has-tempo' : 'details-grid';

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
                ${variationHtml}
                <div class="${gridClass}">
                    <div class="detail-box"><span class="detail-label">Séries</span><span class="detail-value">${exo.sets}</span></div>
                    <div class="detail-box"><span class="detail-label">Reps</span><span class="detail-value">${repsDisplay}</span></div>
                    <div class="detail-box"><span class="detail-label">Repos</span><span class="detail-value">${exo.rest}</span></div>
                    ${tempoHtml}
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
        fireConfetti();
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        if (whatsappBtn) document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        loadCoachNoteIntoModal();
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
    if (!getSettingSound()) return;
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

function fireConfetti() {
    const colors = ['#B76E79', '#965A62', '#fff', '#FFE4E1'];
    const container = document.body;
    for (let i = 0; i < 35; i++) {
        const el = document.createElement('div');
        el.className = 'confetti';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = Math.random() * 0.5 + 's';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.width = (6 + Math.random() * 8) + 'px';
        el.style.height = el.style.width;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }
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

    const coachNoteFree = document.getElementById('coach-note-free');
    if (coachNoteFree && coachNoteFree.value.trim()) {
        setCoachNote(coachNoteFree.value.trim());
        msg += `\n💬 *Message pour toi:*\n${coachNoteFree.value.trim()}\n`;
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

function loadCoachNoteIntoModal() {
    const ta = document.getElementById('coach-note-free');
    if (ta) ta.value = getCoachNote();
}
function saveCoachNoteFromModal() {
    const ta = document.getElementById('coach-note-free');
    if (ta) setCoachNote(ta.value);
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
    saveCoachNoteFromModal();
    refreshCalendarCompletedState();
}

function resetCurrentSession() {
    if (!confirm("Recommencer cette séance ? Toutes les cases seront décochées.")) return;
    const container = document.getElementById('workout-container');
    if (!container) return;
    container.querySelectorAll('.set-checkbox').forEach(cb => { cb.checked = false; });
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = "0%";
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function copyProgramLink() {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => showToast("Lien copié !")).catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
}
function fallbackCopy(url) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast("Lien copié !");
    } catch (_) {
        showToast("Copie impossible");
    }
    document.body.removeChild(ta);
}

function renderCoachSignature() {
    const footer = document.getElementById('coach-signature');
    if (!footer) return;
    footer.innerHTML = (COACH_NAME ? `Programme par ${COACH_NAME}` : '') + ` <span class="app-version">· v${APP_VERSION}</span>`;
}

function renderProgressionPanel() {
    const panel = document.getElementById('progression-panel');
    if (!panel || !globalData || !globalData.sessions) return;
    const saved = JSON.parse(localStorage.getItem('fitapp_' + clientID) || '{}');
    const session = globalData.sessions.find(s => (s.id === currentSessionId) || s.id === currentSessionId);
    if (!session || !session.exercises) { panel.innerHTML = ''; return; }
    let html = '<p class="progression-intro">Dernières charges enregistrées pour cette séance :</p><ul class="progression-list">';
    session.exercises.forEach((exo, idx) => {
        if (exo.type === 'section') return;
        const idCharge = `charge-${currentSessionId}-${idx}`;
        const val = saved[idCharge];
        if (val) html += `<li><strong>${exo.name}</strong> : ${val} kg</li>`;
    });
    html += '</ul>';
    if (html === '<p class="progression-intro">Dernières charges enregistrées pour cette séance :</p><ul class="progression-list"></ul>')
        html = '<p class="progression-intro">Aucune charge enregistrée pour cette séance.</p>';
    panel.innerHTML = html;
}

function initProgressionToggle() {
    const btn = document.getElementById('btn-progression-toggle');
    const panel = document.getElementById('progression-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
        const open = !panel.hidden;
        panel.hidden = open;
        btn.setAttribute('aria-expanded', !open);
        btn.textContent = open ? '📈 Ma progression' : '📈 Masquer la progression';
        if (!open) renderProgressionPanel();
    });
}

function initFocusMode() {
    const btn = document.getElementById('btn-focus-mode');
    const wrap = document.getElementById('calendar-wrap');
    if (!btn || !wrap) return;
    btn.addEventListener('click', () => {
        wrap.classList.toggle('collapsed');
        const on = wrap.classList.contains('collapsed');
        btn.textContent = on ? '◑ Calendrier' : '◐ Focus';
        btn.setAttribute('aria-label', on ? 'Afficher le calendrier' : 'Réduire le calendrier');
        btn.title = on ? 'Afficher le calendrier' : 'Mode focus';
    });
}

function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('setting-sound').checked = getSettingSound();
    const theme = getSettingTheme();
    document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === theme; });
    document.getElementById('setting-notifications').checked = isNotificationEnabled();
}
function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    setSettingSound(document.getElementById('setting-sound').checked);
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    if (themeRadio) {
        setSettingTheme(themeRadio.value);
        applyTheme(themeRadio.value);
    }
    setNotificationEnabled(document.getElementById('setting-notifications').checked);
}
function applyTheme(v) {
    if (v === 'auto') {
        document.documentElement.removeAttribute('data-theme');
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', v);
    }
    updateDarkModeButton();
}
function initSettings() {
    const btn = document.getElementById('btn-settings');
    const overlay = document.getElementById('settings-overlay');
    const closeBtn = overlay && overlay.querySelector('.close-settings');
    const resetBtn = document.getElementById('btn-reset-data');
    if (btn) btn.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
    if (resetBtn) resetBtn.addEventListener('click', () => {
        if (!confirm('Effacer toutes les données de ce programme (séances terminées, charges, notes) ? Cette action est irréversible.')) return;
        localStorage.removeItem('fitapp_' + clientID);
        localStorage.removeItem(COMPLETED_KEY);
        setCoachNote('');
        showToast('Données effacées.');
        closeSettings();
        if (globalData && globalData.sessions && globalData.sessions.length) {
            refreshCalendarCompletedState();
            updateWeekAndNextSession(globalData.sessions);
        }
        const container = document.getElementById('workout-container');
        if (container && container.querySelector('.set-checkbox')) {
            container.querySelectorAll('.set-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('progress-bar').style.width = '0%';
        }
        loadProgress();
        renderProgressionPanel();
    });
}

function initPrintButton() {
    const btn = document.getElementById('btn-print-session');
    if (btn) btn.addEventListener('click', () => { window.print(); showToast('Ouverture de l\'impression...'); });
}

function initOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    function update() {
        banner.hidden = navigator.onLine;
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
}

function maybeShowNotification(sessions) {
    if (!sessions || !sessions.length || !isNotificationEnabled() || !('Notification' in window)) return;
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    if (getLastNotifDate() === todayStr) return;
    const hasSessionToday = sessions.some(s => s.date === todayStr);
    if (!hasSessionToday) return;
    if (Notification.permission === 'granted') {
        try {
            new Notification('Mon Programme Coaching', { body: 'Séance prévue aujourd\'hui ! 💪', icon: 'favicon.svg' });
            setLastNotifDate(todayStr);
        } catch (_) {}
        return;
    }
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') {
                try {
                    new Notification('Mon Programme Coaching', { body: 'Séance prévue aujourd\'hui ! 💪', icon: 'favicon.svg' });
                    setLastNotifDate(todayStr);
                } catch (_) {}
            }
        });
    }
}

function initDarkMode() {
    const btn = document.getElementById('btn-dark-mode');
    if (!btn) return;
    applyTheme(getSettingTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => { if (getSettingTheme() === 'auto') applyTheme('auto'); });
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        setSettingTheme(next);
        applyTheme(next);
        updateDarkModeButton();
    });
}
function updateDarkModeButton() {
    const btn = document.getElementById('btn-dark-mode');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
    btn.title = isDark ? 'Mode clair' : 'Mode sombre';
}

function initCopyLink() {
    const btn = document.getElementById('btn-copy-link');
    if (btn) btn.addEventListener('click', copyProgramLink);
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
    if (e.target.id === 'coach-note-free') setCoachNote(e.target.value);
});
document.body.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const settings = document.getElementById('settings-overlay');
        if (settings && settings.classList.contains('active')) { closeSettings(); e.preventDefault(); }
    }
});

// Initialisation des boutons (disponibles dès le chargement)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initDarkMode(); initCopyLink(); });
} else {
    initDarkMode();
    initCopyLink();
}