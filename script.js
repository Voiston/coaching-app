// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33600000000"; // VÉRITABLE NUMÉRO ICI

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

// Barre de progression
document.body.insertAdjacentHTML('afterbegin', '<div id="progress-container"><div id="progress-bar"></div></div>');

fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => displayProgram(data))
    .catch(() => document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px'>Programme introuvable</h2>");

function displayProgram(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;
    const container = document.getElementById('workout-container');

    data.exercises.forEach((exo, index) => {
        // --- GESTION VIDÉO ---
        let mediaHtml = '';
        if (exo.image && (exo.image.includes('youtube') || exo.image.includes('youtu.be'))) {
            mediaHtml = `<a href="${exo.image}" target="_blank" class="video-btn">▶ Voir la démo vidéo</a>`;
        } else if (exo.image) {
            mediaHtml = `<img src="${exo.image}" class="exercise-img show" loading="lazy">`;
        }

        // --- CHECKBOXES ---
        let setsCount = parseInt(exo.sets) || 3;
        let checkboxesHtml = '<div class="sets-container">';
        for(let i=1; i<=setsCount; i++) {
            checkboxesHtml += `<div>
                <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" onchange="updateProgress()">
                <label for="set-${index}-${i}" class="set-label">${i}</label>
            </div>`;
        }
        checkboxesHtml += '</div>';

        // --- TIMER ---
        let restTime = parseInt(exo.rest) || 60;

        // --- NOUVEAU : CLASSE CSS POUR SUPERSET ---
        // On regarde si le JSON contient une info "superset_type"
        let cardClass = "exercise-card";
        if (exo.superset_type === "start") cardClass += " superset-start";
        if (exo.superset_type === "middle") cardClass += " superset-middle";
        if (exo.superset_type === "end") cardClass += " superset-end";

        const html = `
        <div class="${cardClass}">
            <div class="exercise-header">
                <div class="exercise-title">${exo.name}</div>
                <div class="rpe-badge">RPE: ${exo.rpe_target}</div>
            </div>
            ${mediaHtml}
            <div class="details-grid">
                <div class="detail-box"><span class="detail-label">Séries</span><span class="detail-value">${exo.sets}</span></div>
                <div class="detail-box"><span class="detail-label">Reps</span><span class="detail-value">${exo.reps}</span></div>
                <div class="detail-box"><span class="detail-label">Repos</span><span class="detail-value">${exo.rest}</span></div>
                <button class="timer-btn" onclick="startTimer(this, ${restTime})">
                    <span class="timer-icon">⏱️</span><span class="timer-text">Lancer le repos</span>
                </button>
            </div>
            ${checkboxesHtml}
            ${exo.note_coach ? `<div class="coach-note">💡 "${exo.note_coach}"</div>` : ''}
            <div class="client-input-zone">
                <div class="input-row">
                    <input type="text" id="charge-${index}" placeholder="Charge (kg)">
                    <input type="number" id="rpe-${index}" placeholder="RPE">
                </div>
                <input type="text" id="comment-${index}" placeholder="Note...">
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function updateProgress() {
    const total = document.querySelectorAll('.set-checkbox').length;
    const checked = document.querySelectorAll('.set-checkbox:checked').length;
    const percent = (checked / total) * 100;
    document.getElementById('progress-bar').style.width = percent + "%";

    // --- FIN DE SÉANCE PREMIUM ---
    if (percent === 100) {
        // 1. On rend le corps non scrollable
        document.body.classList.add('modal-open');
        // 2. On affiche l'overlay
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        // 3. On déplace le bouton WhatsApp dans la modale pour le mettre en valeur
        const whatsappBtn = document.querySelector('.whatsapp-sticky button');
        document.getElementById('modal-btn-container').appendChild(whatsappBtn);
        // 4. Petit son de succès (optionnel, vibre sur mobile)
        if("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    }
}

// --- TIMER (Inchangé) ---
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

// --- WHATSAPP (Inchangé) ---
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
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}