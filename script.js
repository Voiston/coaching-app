// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // REMET TON NUMÉRO ICI

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Barre de progression
document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

// Chargement des données
fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
        displayProgram(data);
        loadProgress(); 
    })
    .catch(() => document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px'>Programme introuvable</h2>");

function displayProgram(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;
    const container = document.getElementById('workout-container');

    let currentSupersetContainer = null;

    data.exercises.forEach((exo, index) => {
        // GESTION SECTION
        if (exo.type === "section") {
            if (currentSupersetContainer) { container.appendChild(currentSupersetContainer); currentSupersetContainer = null; }
            container.insertAdjacentHTML('beforeend', `<h2 class="section-title">${exo.title}</h2>`);
            return; 
        }

        // GESTION SUPERSET
        if (exo.superset_type === "start") {
            currentSupersetContainer = document.createElement('div');
            currentSupersetContainer.className = "superset-row";
        }

        const cardHtml = createExerciseCard(exo, index);
        
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

    // Initialisation hauteur accordéon
    setTimeout(() => {
        document.querySelectorAll('.exercise-card.open .exercise-content').forEach(content => {
            content.style.maxHeight = content.scrollHeight + "px";
        });
    }, 100);
}

function createExerciseCard(exo, index) {
    let mediaHtml = '';
    if (exo.image && (exo.image.includes('youtube') || exo.image.includes('youtu.be'))) {
        mediaHtml = `<a href="${exo.image}" target="_blank" class="video-btn">▶ Voir la démo vidéo</a>`;
    } else if (exo.image) {
        mediaHtml = `<img src="${exo.image}" class="exercise-img show" loading="lazy">`;
    }

    let setsCount = parseInt(exo.sets) || 3;
    let checkboxesHtml = '<div class="sets-container">';
    for(let i=1; i<=setsCount; i++) {
        checkboxesHtml += `<div>
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" onchange="checkSetAndCollapse(this, ${index}, ${i}, ${setsCount})">
            <label for="set-${index}-${i}" class="set-label">${i}</label>
        </div>`;
    }
    checkboxesHtml += '</div>';

    // IMPORTANT : On ajoute data-index="${index}" pour retrouver le bon ID plus tard
    return `
    <div class="exercise-card open" id="card-${index}" data-index="${index}">
        <div class="exercise-header" onclick="toggleCard(this)">
            <div>
                <div class="exercise-title">${exo.name}</div>
                <div class="rpe-badge">RPE: ${exo.rpe_target}</div>
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
                        <input type="text" id="charge-${index}" placeholder="Charge (kg)" oninput="saveAndProgress()">
                        <input type="number" id="rpe-${index}" placeholder="RPE" oninput="saveAndProgress()">
                    </div>
                    <input type="text" id="comment-${index}" placeholder="Note..." oninput="saveAndProgress()">
                </div>
            </div>
        </div>
    </div>`;
}

// Fonction de repli
function checkSetAndCollapse(checkbox, cardIndex, setNumber, totalSets) {
    saveAndProgress(); // Sauvegarde standard
    if (checkbox.checked && setNumber === totalSets) {
        const card = document.getElementById(`card-${cardIndex}`);
        if (card.classList.contains('open')) {
            setTimeout(() => { toggleCard(card.querySelector('.exercise-header')); }, 300);
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
    updateProgress(true); // True = Autoriser la vibration
    saveData();
}

// updateProgress modifiée : on ajoute le paramètre 'shouldOpenModal'
function updateProgress(shouldOpenModal = false) {
    const total = document.querySelectorAll('.set-checkbox').length;
    const checked = document.querySelectorAll('.set-checkbox:checked').length;
    const percent = (total === 0) ? 0 : (checked / total) * 100;
    
    document.getElementById('progress-bar').style.width = percent + "%";

    // ON NE LANCE LA MODALE QUE SI :
    // 1. On est à 100%
    // 2. ET que l'action vient d'un clic utilisateur (shouldOpenModal est vrai)
    if (percent === 100 && shouldOpenModal) {
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        
        // Déplacement du bouton
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        // Vérif de sécurité pour ne pas le déplacer s'il est déjà là
        if(document.querySelector('.whatsapp-sticky button')) {
             document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        }

        if("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    }
}

function saveData() {
    const dataToSave = {};
    document.querySelectorAll('.set-checkbox').forEach(box => { dataToSave[box.id] = box.checked; });
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => { dataToSave[input.id] = input.value; });
    localStorage.setItem('fitapp_' + clientID, JSON.stringify(dataToSave));
}

function loadProgress() {
    const saved = localStorage.getItem('fitapp_' + clientID);
    if (!saved) return;
    const data = JSON.parse(saved);
    for (const [id, value] of Object.entries(data)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    }
    // ICI : on met FALSE pour dire "N'ouvre pas la modale, c'est juste un chargement"
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
// Fonction pour fermer la modale manuellement
function closeModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('completion-overlay').classList.remove('active');
    
    // On remet le bouton WhatsApp à sa place d'origine (en bas de page)
    const whatsappBtn = document.querySelector('#modal-btn-container button');
    if(whatsappBtn) {
        document.querySelector('.whatsapp-sticky').appendChild(whatsappBtn);
    }
}
// --- FONCTION CORRIGÉE POUR WHATSAPP ---
function sendToWhatsapp() {
    let msg = `*Rapport Final - ${document.getElementById('client-name').innerText}*\n`;
    msg += `_${document.getElementById('program-title').innerText}_\n\n`;

    // CORRECTION : On ne se fie plus à l'index "i" de la boucle, mais au "data-index" stocké
    document.querySelectorAll('.exercise-card').forEach((card) => {
        const originalIndex = card.dataset.index; // On récupère le VRAI numéro
        
        const title = card.querySelector('.exercise-title').innerText;
        // On utilise originalIndex pour trouver les bons inputs
        const load = document.getElementById(`charge-${originalIndex}`).value;
        const rpe = document.getElementById(`rpe-${originalIndex}`).value;
        const note = document.getElementById(`comment-${originalIndex}`).value;
        
        if(load || rpe || note) {
            msg += `🔹 *${title}*\n`;
            if(load) msg += `   ⚖️ ${load}kg\n`;
            if(rpe)  msg += `   🔥 RPE ${rpe}\n`;
            if(note) msg += `   📝 ${note}\n`;
        }
    });

    // BILAN DE SÉANCE
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

    if(confirm("Confirmer l'envoi et vider les données ?")) {
        localStorage.removeItem('fitapp_' + clientID);
    }
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}