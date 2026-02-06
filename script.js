// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // TON NUMÉRO

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Variables Globales pour le multi-séances
let globalData = null;
let currentSessionId = "default"; 

document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

// --- CHARGEMENT INITIAL ---
fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
        globalData = data;
        initApp(data);
    })
    .catch(() => document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px'>Programme introuvable</h2>");

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

// --- CALENDRIER ROULANT AVEC DATES RÉELLES ---
function renderCalendar(sessions) {
    const calendarContainer = document.getElementById('calendar-strip');
    calendarContainer.innerHTML = "";
    
    // On génère les 14 prochains jours
    const daysToShow = 21; 
    const today = new Date();

    // Mapping jours Anglais (JS) -> Français (JSON)
    const dayMap = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

    for (let i = 0; i < daysToShow; i++) {
        // Créer la date (Aujourd'hui + i)
        const date = new Date();
        date.setDate(today.getDate() + i);

        const dayIndex = date.getDay(); // 0-6
        const dayNameFR = dayMap[dayIndex]; // "lundi", "mardi"...
        const dateNum = date.getDate(); // 12, 13...
        
        // Chercher si une séance existe pour ce jour de la semaine
        const sessionIndex = sessions.findIndex(s => s.day && s.day.toLowerCase() === dayNameFR);
        const hasSession = sessionIndex !== -1;

        // Création de la carte HTML
        const dayEl = document.createElement('div');
        
        // Classes CSS
        let classes = "calendar-day";
        if (hasSession) classes += " has-session";
        
        // Vérifier si cette séance spécifique est "Terminée" (Bonus UX)
        // On regarde si on a déjà un localStorage pour cette séance
        // (Note: C'est approximatif car basé sur l'ID de séance, mais efficace)
        if (hasSession) {
            const sId = sessions[sessionIndex].id || `session_${sessionIndex}`;
            const savedData = JSON.parse(localStorage.getItem('fitapp_' + clientID) || '{}');
            // Si on trouve des données pour cette séance, on peut la marquer (optionnel)
            // Pour l'instant on reste simple.
        }

        dayEl.className = classes;
        
        // Formatage de l'affichage (Jeu 12)
        const shortName = dayNameFR.substring(0, 3).toUpperCase(); // LUN
        
        dayEl.innerHTML = `
            <span class="day-name">${shortName}</span>
            <span class="day-date">${dateNum}</span>
        `;

        // Interaction Clic
        dayEl.onclick = () => {
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
            dayEl.classList.add('active');

            if (hasSession) {
                // On injecte aussi la date réelle dans le titre pour faire pro
                const fullDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                // Petit hack pour mettre à jour le sous-titre si tu veux
                // document.getElementById('program-title').textContent = fullDate; 
                
                renderSession(sessionIndex);
            } else {
                showRestDay(dayNameFR); // On passe le nom complet (Mardi)
            }
        };

        // Auto-sélectionner le PREMIER jour (Aujourd'hui)
        if (i === 0) {
            setTimeout(() => dayEl.click(), 50);
        }

        calendarContainer.appendChild(dayEl);
    }
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

// --- MOTEUR D'AFFICHAGE DE SÉANCE (CELUI QUI MANQUAIT !) ---
function renderSession(sessionIndex) {
    const session = globalData.sessions[sessionIndex];
    const container = document.getElementById('workout-container');
    
    // Définir l'ID unique de la séance actuelle pour la sauvegarde
    currentSessionId = session.id || `session_${sessionIndex}`;

    // Reset de l'interface
    container.innerHTML = ""; 
    document.getElementById('progress-bar').style.width = "0%";

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

    for(let i=1; i<=setsCount; i++) {
        checkboxesHtml += `<div>
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" onchange="checkSetAndCollapse(this, ${index}, ${i}, ${setsCount})">
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

    return `
    <div class="exercise-card open" id="card-${index}" data-index="${index}">
        <div class="exercise-header" onclick="toggleCard(this)">
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
                    <button class="timer-btn" onclick="startTimer(this, ${parseInt(exo.rest)||60})">
                        <span class="timer-icon">⏱️</span><span class="timer-text">Lancer le repos</span>
                    </button>
                </div>
                ${checkboxesHtml}
                ${exo.note_coach ? `<div class="coach-note">💡 "${exo.note_coach}"</div>` : ''}
                <div class="client-input-zone">
                    <div class="input-row">
                        <input type="text" id="${idCharge}" placeholder="Charge (kg)" oninput="saveAndProgress()">
                        <input type="number" id="${idRpe}" placeholder="RPE" oninput="saveAndProgress()">
                    </div>
                    <input type="text" id="${idCom}" placeholder="Note..." oninput="saveAndProgress()">
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
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        if(document.querySelector('.whatsapp-sticky button')) {
             document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        }
        if("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
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

function startTimer(btn, seconds) {
    if(btn.classList.contains('active')) return;
    let timeLeft = seconds;
    btn.classList.add('active');
    btn.querySelector('.timer-text').textContent = `Repos : ${timeLeft}s`;
    const interval = setInterval(() => {
        timeLeft--;
        btn.querySelector('.timer-text').textContent = `Repos : ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            btn.classList.remove('active');
            btn.querySelector('.timer-text').textContent = "Terminé !";
            if("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
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

    const sMuscle = document.getElementById('score-muscle').value;
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

function closeModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('completion-overlay').classList.remove('active');
    const whatsappBtn = document.querySelector('#modal-btn-container button');
    if(whatsappBtn) {
        document.querySelector('.whatsapp-sticky').appendChild(whatsappBtn);
    }
}