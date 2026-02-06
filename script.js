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

// Remplace tout ton initApp par ça :
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

// --- NOUVELLE FONCTION CALENDRIER ---
function renderCalendar(sessions) {
    const calendarContainer = document.getElementById('calendar-strip');
    calendarContainer.innerHTML = "";
    
    const daysOfWeek = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    
    // Trouver le jour actuel (0 = Lundi pour nous, mais JS : 0 = Dimanche)
    const todayDate = new Date();
    let todayIndex = todayDate.getDay() - 1; // JS: Dim=0, Lun=1... Nous on veut Lun=0
    if (todayIndex === -1) todayIndex = 6; // Si c'est Dimanche (-1), on le met à la fin (6)

    daysOfWeek.forEach((dayName, index) => {
        // Chercher si une séance existe pour ce jour
        // On normalise (minuscules) pour éviter les erreurs de saisie
        const sessionIndex = sessions.findIndex(s => s.day && s.day.toLowerCase() === dayName.toLowerCase());
        const hasSession = sessionIndex !== -1;

        const dayEl = document.createElement('div');
        dayEl.className = `calendar-day ${hasSession ? 'has-session' : ''}`;
        
        // Abréviation (LUN, MAR...)
        const shortName = dayName.substring(0, 3);
        
        dayEl.innerHTML = `
            <span class="day-name">${shortName}</span>
            <div class="day-indicator"></div>
        `;

        // Clic sur le jour
        dayEl.onclick = () => {
            // Gestion visuelle "Actif"
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
            dayEl.classList.add('active');

            if (hasSession) {
                // Charger la séance
                renderSession(sessionIndex);
            } else {
                // Afficher "Repos"
                showRestDay(dayName);
            }
        };

        // Auto-sélectionner le jour d'aujourd'hui au chargement
        if (index === todayIndex) {
            setTimeout(() => dayEl.click(), 100); // Petit délai pour l'animation
        }

        calendarContainer.appendChild(dayEl);
    });
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
}

// Fonction appelée par le <select> HTML
function switchSession(index) {
    if(confirm("Changer de séance ? (Les cases cochées seront remises à zéro, mais tes charges sont sauvegardées)")) {
        renderSession(index);
    } else {
        // Si l'utilisateur annule, on pourrait remettre le select sur l'ancienne valeur
        // Mais pour l'instant, on laisse simple.
    }
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

    // CONSTRUCTION DES IDs UNIQUES (Ex: charge-seanceA-0)
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
    
    // On sauvegarde aussi quand on coche (au cas où on quitte juste après)
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

// Wrapper simple pour sauvegarder lors de la frappe
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
    // On sauvegarde TOUS les inputs présents sur la page (Texte et Nombre)
    // Grâce aux IDs uniques (avec sessionId), pas de conflit !
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        // On ne sauvegarde pas les inputs du bilan final ici (ils ont leurs propres IDs fixes)
        // Mais on s'assure de ne pas sauvegarder n'importe quoi
        if(input.id && !input.id.startsWith('score-') && !input.id.startsWith('com-')) {
            dataToSave[input.id] = input.value;
        }
    });

    // On fusionne avec ce qui existe déjà dans le localStorage pour ne pas écraser les autres séances
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
        // Si l'élément existe sur la page actuelle (donc dans la bonne séance), on le remplit
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
    
    // Récupérer le nom de la séance active dans le selecteur (si dispo)
    const select = document.getElementById('session-select');
    let sessionName = "";
    if(select && select.options.length > 0) {
        sessionName = select.options[select.selectedIndex].text;
    } else {
        sessionName = document.getElementById('program-title').innerText;
    }

    msg += `📂 *${sessionName}*\n\n`;

    document.querySelectorAll('.exercise-card').forEach((card) => {
        const originalIndex = card.dataset.index;
        const title = card.querySelector('.exercise-title').innerText;
        
        // RECONSTRUCTION DES IDs pour récupérer les valeurs
        const idCharge = `charge-${currentSessionId}-${originalIndex}`;
        const idRpe = `rpe-${currentSessionId}-${originalIndex}`;
        const idCom = `comment-${currentSessionId}-${originalIndex}`;

        // On utilise getElementById car on connait l'ID exact
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

    // Ajout du bilan global (Formulaire de fin)
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

    // Pas de suppression du localStorage ici pour garder l'historique des charges
    // On pourrait optionnellement vider juste les cases "note" si voulu
    
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