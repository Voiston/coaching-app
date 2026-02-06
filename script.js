// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // TON NUMÉRO ICI

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Barre de progression
document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

// Chargement des données
fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
        displayProgram(data);
        loadProgress(); // Restaure les données sauvegardées
    })
    .catch(() => document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px'>Programme introuvable</h2>");

function displayProgram(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;
    const container = document.getElementById('workout-container');

    let currentSupersetContainer = null;

    data.exercises.forEach((exo, index) => {
        
        // 1. GESTION DES SECTIONS
        if (exo.type === "section") {
            // Si on était dans un superset, on le ferme
            if (currentSupersetContainer) { container.appendChild(currentSupersetContainer); currentSupersetContainer = null; }
            
            const sectionHtml = `<h2 class="section-title">${exo.title}</h2>`;
            container.insertAdjacentHTML('beforeend', sectionHtml);
            return; // On passe à l'élément suivant, ce n'est pas un exercice
        }

        // 2. GESTION DES SUPERSETS (Grouping)
        // Si c'est le début d'un superset, on crée un conteneur "Row"
        if (exo.superset_type === "start") {
            currentSupersetContainer = document.createElement('div');
            currentSupersetContainer.className = "superset-row";
        }

        // --- CRÉATION DE LA CARTE ---
        const cardHtml = createExerciseCard(exo, index);
        
        // On injecte la carte soit dans le container principal, soit dans le container superset
        if (currentSupersetContainer) {
            currentSupersetContainer.innerHTML += cardHtml;
            // Si c'est la fin du superset, on ajoute le container entier au site et on le vide
            if (exo.superset_type === "end") {
                container.appendChild(currentSupersetContainer);
                currentSupersetContainer = null;
            }
        } else {
            // Exercice normal
            container.insertAdjacentHTML('beforeend', cardHtml);
        }
    });

    // Sécurité : si un superset a été commencé mais jamais fini dans le JSON
    if (currentSupersetContainer) container.appendChild(currentSupersetContainer);
}

function createExerciseCard(exo, index) {
    // Gestion Vidéo/Image
    let mediaHtml = '';
    if (exo.image && (exo.image.includes('youtube') || exo.image.includes('youtu.be'))) {
        mediaHtml = `<a href="${exo.image}" target="_blank" class="video-btn">▶ Voir la démo vidéo</a>`;
    } else if (exo.image) {
        mediaHtml = `<img src="${exo.image}" class="exercise-img show" loading="lazy">`;
    }

    // Checkboxes
    let setsCount = parseInt(exo.sets) || 3;
    let checkboxesHtml = '<div class="sets-container">';
    for(let i=1; i<=setsCount; i++) {
        checkboxesHtml += `<div>
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" onchange="saveAndProgress()">
            <label for="set-${index}-${i}" class="set-label">${i}</label>
        </div>`;
    }
    checkboxesHtml += '</div>';

    // HTML Structure (Accordéon)
    return `
    <div class="exercise-card" id="card-${index}">
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

// --- LOGIQUE ACCORDÉON ---
function toggleCard(header) {
    const card = header.parentElement;
    const content = card.querySelector('.exercise-content');
    
    // Si déjà ouvert, on ferme
    if (card.classList.contains('open')) {
        card.classList.remove('open');
        content.style.maxHeight = null;
    } else {
        // Optionnel : Fermer les autres cartes pour le "Focus Mode" strict
        // document.querySelectorAll('.exercise-card.open').forEach(c => {
        //     c.classList.remove('open');
        //     c.querySelector('.exercise-content').style.maxHeight = null;
        // });

        card.classList.add('open');
        content.style.maxHeight = content.scrollHeight + "px";
    }
}

// --- MÉMOIRE & PROGRESSION ---
function saveAndProgress() {
    updateProgress();
    saveData();
}

function updateProgress() {
    const total = document.querySelectorAll('.set-checkbox').length;
    const checked = document.querySelectorAll('.set-checkbox:checked').length;
    const percent = (total === 0) ? 0 : (checked / total) * 100;
    
    document.getElementById('progress-bar').style.width = percent + "%";

    if (percent === 100) {
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        if("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        // Reset storage après complétion ? Non, on laisse l'utilisateur décider.
    }
}

// Sauvegarder dans le téléphone
function saveData() {
    const dataToSave = {};
    // Sauve checkboxes
    document.querySelectorAll('.set-checkbox').forEach(box => {
        dataToSave[box.id] = box.checked;
    });
    // Sauve inputs
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        dataToSave[input.id] = input.value;
    });
    
    localStorage.setItem('fitapp_' + clientID, JSON.stringify(dataToSave));
}

// Recharger les données au démarrage
function loadProgress() {
    const saved = localStorage.getItem('fitapp_' + clientID);
    if (!saved) return;

    const data = JSON.parse(saved);
    
    // Restaurer Checkboxes
    for (const [id, value] of Object.entries(data)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    }
    updateProgress(); // Mettre à jour la barre
}

// --- TIMER & WHATSAPP (Inchangés) ---
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
    let msg = `*Fin de Séance - ${document.getElementById('client-name').innerText}*\n_${document.getElementById('program-title').innerText}_\n\n`;
    document.querySelectorAll('.exercise-card').forEach((card, i) => {
        const title = card.querySelector('.exercise-title').innerText;
        const load = document.getElementById(`charge-${i}`).value;
        const rpe = document.getElementById(`rpe-${i}`).value;
        const note = document.getElementById(`comment-${i}`).value;
        if(load || rpe || note) msg += `🔹 *${title}*\n${load ? '⚖️ '+load+'kg ' : ''}${rpe ? '🔥 '+rpe+' ' : ''}\n${note ? '📝 '+note+'\n' : ''}\n`;
    });
    msg += `\nEnvoyé depuis mon App Coaching 🏋️‍♀️`;
    // On vide la mémoire après l'envoi pour la prochaine séance
    if(confirm("Veux-tu vider les données pour la prochaine fois ?")) {
        localStorage.removeItem('fitapp_' + clientID);
    }
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}