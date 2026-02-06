// --- CONFIGURATION COACH ---
const COACH_PHONE_NUMBER = "33600000000"; // CHANGE CECI

// --- INIT ---
const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Ajout de la barre de progression au chargement
document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(response => {
        if (!response.ok) throw new Error("Client introuvable");
        return response.json();
    })
    .then(data => {
        displayProgram(data);
    })
    .catch(error => {
        document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px'>Programme introuvable</h2>";
    });

function displayProgram(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;
    const container = document.getElementById('workout-container');

    data.exercises.forEach((exo, index) => {
        const imgClass = exo.image ? "exercise-img show" : "exercise-img";
        
        // --- LOGIQUE POUR LES CHECKBOXES ---
        // On essaie de trouver un chiffre dans "4 séries" ou "3 sets". Si pas de chiffre, par défaut 3.
        let setsCount = parseInt(exo.sets);
        if (isNaN(setsCount)) setsCount = 3; 

        let checkboxesHtml = '<div class="sets-container">';
        for(let i=1; i<=setsCount; i++) {
            checkboxesHtml += `
                <div>
                    <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" onchange="updateProgress()">
                    <label for="set-${index}-${i}" class="set-label">${i}</label>
                </div>
            `;
        }
        checkboxesHtml += '</div>';

        // --- LOGIQUE DU TIMER (REPOS) ---
        // On nettoie le texte (ex: "90 sec" -> 90)
        let restTime = parseInt(exo.rest);
        if (isNaN(restTime)) restTime = 60; // Défaut 60s si mal écrit

        const html = `
        <div class="exercise-card">
            <div class="exercise-header">
                <div class="exercise-title">${exo.name}</div>
                <div class="rpe-badge">RPE: ${exo.rpe_target}</div>
            </div>

            <img src="${exo.image}" class="${imgClass}" loading="lazy">

            <div class="details-grid">
                <div class="detail-box">
                    <span class="detail-label">Séries</span>
                    <span class="detail-value">${exo.sets}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">Reps</span>
                    <span class="detail-value">${exo.reps}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">Repos</span>
                    <span class="detail-value">${exo.rest}</span>
                </div>
                
                <button class="timer-btn" onclick="startTimer(this, ${restTime})">
                    <span class="timer-icon">⏱️</span> 
                    <span class="timer-text">Lancer le repos</span>
                </button>
            </div>

            ${checkboxesHtml}

            ${exo.note_coach ? `<div class="coach-note">💡 "${exo.note_coach}"</div>` : ''}

            <div class="client-input-zone">
                <div class="input-row">
                    <input type="text" id="charge-${index}" placeholder="Charge (kg)">
                    <input type="number" id="rpe-${index}" placeholder="RPE Ressenti">
                </div>
                <input type="text" id="comment-${index}" placeholder="Note rapide...">
            </div>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// --- FONCTION BARRE DE PROGRESSION ---
function updateProgress() {
    const checkboxes = document.querySelectorAll('.set-checkbox');
    const checked = document.querySelectorAll('.set-checkbox:checked');
    
    // Calcul du pourcentage
    const percent = (checked.length / checkboxes.length) * 100;
    document.getElementById('progress-bar').style.width = percent + "%";
}

// --- FONCTION CHRONO ---
function startTimer(btn, seconds) {
    if(btn.classList.contains('active')) return; // Déjà en cours

    let timeLeft = seconds;
    btn.classList.add('active');
    
    // Mise à jour immédiate
    btn.querySelector('.timer-text').textContent = `Repos : ${timeLeft}s`;

    const interval = setInterval(() => {
        timeLeft--;
        btn.querySelector('.timer-text').textContent = `Repos : ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            btn.classList.remove('active');
            btn.querySelector('.timer-text').textContent = "Terminé ! (Relancer)";
            // Petit son ou vibration possible ici
            if("vibrate" in navigator) navigator.vibrate(200);
        }
    }, 1000);
}

// --- FONCTION WHATSAPP (Même qu'avant) ---
function sendToWhatsapp() {
    let message = `*Retour Séance - ${document.getElementById('client-name').innerText}*\n`;
    message += `_${document.getElementById('program-title').innerText}_\n\n`;
    const cards = document.querySelectorAll('.exercise-card');
    
    cards.forEach((card, index) => {
        const title = card.querySelector('.exercise-title').innerText;
        const charge = document.getElementById(`charge-${index}`).value;
        const rpe = document.getElementById(`rpe-${index}`).value;
        const comment = document.getElementById(`comment-${index}`).value;

        if(charge || rpe || comment) {
            message += `🔹 *${title}*\n`;
            if(charge) message += `   ⚖️ ${charge}\n`;
            if(rpe)    message += `   🔥 RPE ${rpe}\n`;
            if(comment) message += `   📝 ${comment}\n`;
        }
    });
    message += `\nEnvoyé depuis mon App Coaching 🏋️‍♀️`;
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}
