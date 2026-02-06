// --- CONFIGURATION COACH ---
const COACH_PHONE_NUMBER = "33600000000"; // REMPLACE PAR TON NUMÉRO (ex: 33612345678)

// Récupérer le nom du client dans l'URL (?client=prenom)
const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo'; // Charge 'demo.json' par défaut

// Chargement des données
fetch(`./clients/${clientID.toLowerCase()}.json`)
    .then(response => {
        if (!response.ok) throw new Error("Client introuvable");
        return response.json();
    })
    .then(data => {
        displayProgram(data);
    })
    .catch(error => {
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px; color:#c58c85'>Oups ! Programme introuvable.<br>Vérifie le lien.</h2>";
    });

function displayProgram(data) {
    document.getElementById('client-name').textContent = `Bonjour ${data.clientName} !`;
    document.getElementById('program-title').textContent = data.programTitle;

    const container = document.getElementById('workout-container');
    
    data.exercises.forEach((exo, index) => {
        // Gestion de l'image (si vide, on ne l'affiche pas)
        const imgClass = exo.image ? "exercise-img show" : "exercise-img";
        
        const html = `
        <div class="exercise-card">
            <div class="exercise-header">
                <div class="exercise-title">${exo.name}</div>
                <div class="rpe-badge">RPE Cible : ${exo.rpe_target}</div>
            </div>

            <img src="${exo.image}" class="${imgClass}" alt="${exo.name}">

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
            </div>

            ${exo.note_coach ? `<div class="coach-note">💡 Coach: "${exo.note_coach}"</div>` : ''}

            <div class="client-input-zone">
                <div class="input-row">
                    <input type="text" id="charge-${index}" placeholder="Charge utilisée (kg)">
                    <input type="number" id="rpe-${index}" placeholder="RPE Ressenti (1-10)">
                </div>
                <input type="text" id="comment-${index}" placeholder="Une petite note sur cet exo ?">
            </div>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function sendToWhatsapp() {
    let message = `*Rapport Séance - ${document.getElementById('client-name').innerText}*\n`;
    message += `_${document.getElementById('program-title').innerText}_\n\n`;

    const cards = document.querySelectorAll('.exercise-card');
    
    cards.forEach((card, index) => {
        const title = card.querySelector('.exercise-title').innerText;
        const charge = document.getElementById(`charge-${index}`).value;
        const rpe = document.getElementById(`rpe-${index}`).value;
        const comment = document.getElementById(`comment-${index}`).value;

        // On ajoute l'exo au message seulement si la cliente a noté quelque chose
        if(charge || rpe || comment) {
            message += `🔹 *${title}*\n`;
            if(charge) message += `   ⚖️ Charge: ${charge}\n`;
            if(rpe)    message += `   🔥 RPE: ${rpe}\n`;
            if(comment) message += `   📝 Note: ${comment}\n`;
            message += `\n`;
        }
    });

    message += `\nEnvoyé depuis mon App Coaching 🏋️‍♀️`;

    // Création du lien WhatsApp
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
}