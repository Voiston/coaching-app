// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33662110786"; // TON NUMÉRO
const COACH_NAME = "David";
const DEFAULT_RECOVERY_VIDEO_URL = "https://www.youtube.com/watch?v=4BOTvaRaDjI"; // Stretching générique 10min
const APP_VERSION = "2.5";
const PAST_DAYS = 3;
const DAYS_AHEAD = 21;

const urlParams = new URLSearchParams(window.location.search);
const clientID = urlParams.get('client') || 'demo';

let globalData = null;
let currentSessionId = "default";
let currentSessionDate = "";
let sessionStartTime = null;
let sessionEndTime = null;

// --- PARAMÈTRES (localStorage) ---
const KEY_SOUND = 'fitapp_sound_' + clientID;
const KEY_THEME = 'fitapp_theme_' + clientID;
const KEY_COACH_NOTE = 'fitapp_coach_note_' + clientID;
const KEY_NOTIF_DAY = 'fitapp_notif_day_' + clientID;
const KEY_NOTIF_ENABLED = 'fitapp_notif_enabled_' + clientID;
const KEY_INSTALL_DISMISSED = 'fitapp_install_dismissed_' + clientID;
const KEY_GUIDED_MODE = 'fitapp_guided_' + clientID;
const KEY_CHARGE_HISTORY = 'fitapp_charge_history_' + clientID;

function getSettingSound() { return localStorage.getItem(KEY_SOUND) !== '0'; }
function setSettingSound(on) { localStorage.setItem(KEY_SOUND, on ? '1' : '0'); }
function getSettingTheme() { return localStorage.getItem(KEY_THEME) || 'light'; }
function setSettingTheme(v) { localStorage.setItem(KEY_THEME, v); }
function getCoachNote() { return localStorage.getItem(KEY_COACH_NOTE) || ''; }
function setCoachNote(t) { localStorage.setItem(KEY_COACH_NOTE, (t || '').trim()); }
function isNotificationEnabled() { return localStorage.getItem(KEY_NOTIF_ENABLED) === '1'; }
function setNotificationEnabled(on) { localStorage.setItem(KEY_NOTIF_ENABLED, on ? '1' : '0'); }
function isInstallDismissed() { return localStorage.getItem(KEY_INSTALL_DISMISSED) === '1'; }
function setInstallDismissed() { localStorage.setItem(KEY_INSTALL_DISMISSED, '1'); }
function isGuidedMode() { return localStorage.getItem(KEY_GUIDED_MODE) === '1'; }
function setGuidedMode(on) { localStorage.setItem(KEY_GUIDED_MODE, on ? '1' : '0'); }
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
fetch(`./clients/${clientID.toLowerCase()}.json?t=${Date.now()}`, { cache: 'no-store' })
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
    const resetWrap = document.getElementById('reset-session-wrap');
    if (resetWrap) resetWrap.innerHTML = "";
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
    initInstallPrompt();
    initGuidedMode();
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
    const resetWrap = document.getElementById('reset-session-wrap');
    if (resetWrap) resetWrap.innerHTML = "";
    const waBottom = document.getElementById('whatsapp-bottom');
    if (waBottom) waBottom.style.display = 'none';
    const recoveryUrl = (globalData && globalData.recovery_url && String(globalData.recovery_url).trim())
        ? globalData.recovery_url
        : DEFAULT_RECOVERY_VIDEO_URL;
    const container = document.getElementById('workout-container');
    container.innerHTML = `
        <div class="rest-day-message">
            <span class="rest-icon" aria-hidden="true">🧘‍♀️</span>
            <h2>Jour de récup' — ${dayName}</h2>
            <p class="rest-lead">La récupération fait partie de la progression. Ton corps construit pendant le repos.</p>
            <p class="rest-tip">Hydrate-toi bien, mange équilibré et dors à ta soif. La prochaine séance t'attend ! 💪</p>
            <button type="button" class="btn-recovery-video" data-recovery-url="${recoveryUrl.replace(/"/g, '&quot;')}" aria-label="Lancer la routine Récupération (10 minutes)">🧘‍♀️ Lancer ma routine Récupération (10min)</button>
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
    sessionStartTime = null;
    sessionEndTime = null;

    const waBottom = document.getElementById('whatsapp-bottom');
    if (waBottom) waBottom.style.display = '';

    container.innerHTML = "";
    document.getElementById('progress-bar').style.width = "0%";

    const resetWrap = document.getElementById('reset-session-wrap');
    if (resetWrap) {
        resetWrap.innerHTML = "";
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'reset-session-btn';
        resetBtn.setAttribute('data-reset-session', '1');
        resetBtn.setAttribute('aria-label', 'Recommencer la séance et décocher toutes les séries');
        resetBtn.textContent = "↺ Recommencer la séance";
        resetWrap.appendChild(resetBtn);
    }

    let currentSupersetBlock = null;
    let supersetPos = 0;
    let inWarmupSection = false;

    const sessionIntro = (session.session_intro || session.objectives || session.coach_notes || '').toString().trim();
    if (sessionIntro) {
        const safe = sessionIntro.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        container.insertAdjacentHTML('beforeend', `<div class="coach-notes-intro"><div class="coach-notes-text">${safe}</div></div>`);
    }

    session.exercises.forEach((exo, index) => {
        if (exo.type === "section") {
            if (currentSupersetBlock) {
                container.appendChild(currentSupersetBlock);
                currentSupersetBlock = null;
                supersetPos = 0;
            }
            const titleNorm = (exo.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const isWarmupSection = titleNorm.includes('echauffement');
            if (exo.coach_notes) {
                const notes = String(exo.coach_notes).trim();
                if (notes) {
                    const safe = notes.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    container.insertAdjacentHTML('beforeend', `<div class="coach-notes-intro"><div class="coach-notes-text">${safe}</div></div>`);
                }
            }
            container.insertAdjacentHTML('beforeend', `<h2 class="section-title">${exo.title}</h2>`);
            inWarmupSection = isWarmupSection;
            return;
        }

        if (currentSupersetBlock) supersetPos++;

        if (exo.superset_type === "start") {
            currentSupersetBlock = document.createElement('div');
            currentSupersetBlock.className = "superset-block";
            currentSupersetBlock.innerHTML = '<div class="superset-label">Superset</div><div class="superset-row"></div>';
            supersetPos = 1;
        }

        const cardHtml = createExerciseCard(exo, index, currentSessionId, supersetPos > 0 ? supersetPos : null, inWarmupSection);
        const row = currentSupersetBlock ? currentSupersetBlock.querySelector('.superset-row') : null;

        if (row) {
            row.insertAdjacentHTML('beforeend', cardHtml);
            if (exo.superset_type === "end") {
                container.appendChild(currentSupersetBlock);
                currentSupersetBlock = null;
                supersetPos = 0;
            }
        } else {
            container.insertAdjacentHTML('beforeend', cardHtml);
        }
    });
    if (currentSupersetBlock) container.appendChild(currentSupersetBlock);

    // Initialisation des hauteurs pour l'animation accordéon
    setTimeout(() => {
        document.querySelectorAll('.exercise-card.open .exercise-content').forEach(content => {
            content.style.maxHeight = content.scrollHeight + "px";
        });
    }, 100);

    loadProgress();
    renderProgressionPanel();
    updateSupersetHighlight();
    updateAllExerciseDetails();
    if (document.body.classList.contains('guided-mode')) {
        guidedViewIndex = 0;
        setTimeout(() => { guidedViewIndex = getFirstIncompleteIndex(); updateGuidedMode(); }, 150);
    }
}

function createExerciseCard(exo, index, sessionId, supersetRoleNum, isWarmupExercise) {
    let mediaHtml = '';
    if (exo.image && (exo.image.includes('youtube') || exo.image.includes('youtu.be'))) {
        mediaHtml = `<a href="${exo.image}" target="_blank" class="video-btn">▶ Voir la démo vidéo</a>`;
    } else if (exo.image) {
        mediaHtml = `<img src="${exo.image}" class="exercise-img show" loading="lazy">`;
    }

    let setsCount = parseInt(exo.sets) || 3;
    const warmupSets = parseInt(exo.warmup_sets) || 0;
    const repsArr = Array.isArray(exo.reps) ? exo.reps : (typeof exo.reps === 'string' && exo.reps.includes(',') ? exo.reps.split(',').map(s => s.trim()) : null);
    const restArr = Array.isArray(exo.rest) ? exo.rest : (typeof exo.rest === 'string' && exo.rest.includes(',') ? exo.rest.split(',').map(s => s.trim()) : null);
    const repsData = repsArr ? JSON.stringify(repsArr) : JSON.stringify([String(exo.reps || '-')]);
    const restData = restArr ? JSON.stringify(restArr) : JSON.stringify([String(exo.rest || '60s')]);
    let checkboxesHtml = '<div class="sets-container">';
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check text-white" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;

    const idCharge = `charge-${sessionId}-${index}`;
    const safeExoName = (exo.name || '').replace(/"/g, '&quot;');
    for (let i = 1; i <= setsCount; i++) {
        const isWarmup = i <= warmupSets;
        const setClass = isWarmup ? ' set-label-warmup' : ' set-label-work';
        const wrapperClass = isWarmup ? ' set-wrapper-warmup' : ' set-wrapper-work';
        checkboxesHtml += `<div class="set-wrapper${wrapperClass}"${isWarmup ? ` data-charge-id="${idCharge}" data-exo-name="${safeExoName}"` : ''}>
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" data-card-index="${index}" data-set-num="${i}" data-total-sets="${setsCount}" aria-label="Série ${i} sur ${setsCount}">
            <label for="set-${index}-${i}" class="set-label${setClass}">
                ${i}
                ${checkIcon}
            </label>
        </div>`;
    }
    checkboxesHtml += '</div>';

    const idRpe = `rpe-${sessionId}-${index}`;
        const idCom = `comment-${sessionId}-${index}`;

    const repsDisplayInit = (exo.until_failure || exo.failure) ? 'Jusqu\'à échec' : (repsArr && repsArr[0] ? repsArr[0] : (exo.reps || '-'));
    const restDisplayInit = restArr && restArr[0] ? restArr[0] : (exo.rest || '60s');
    const isTimeBased = /^\d+\s*(s|sec|min|mn)/i.test(String(exo.reps || ''));
    const timeMatch = String(exo.reps || '').match(/(\d+)\s*(s|sec|min|mn)/i);
    const targetSeconds = timeMatch ? (timeMatch[2].toLowerCase().startsWith('min') ? parseInt(timeMatch[1], 10) * 60 : parseInt(timeMatch[1], 10)) : 45;
    const tempoHtml = exo.tempo ? `<div class="detail-box"><span class="detail-label">Tempo</span><span class="detail-value">${exo.tempo}</span></div>` : '';
    const variationHtml = exo.variation ? `<div class="exercise-variation">Variante : ${exo.variation}</div>` : '';
    const gridClass = exo.tempo ? 'details-grid has-tempo' : 'details-grid';

    const checkTechniqueHtml = (exo.check_technique === true)
        ? (() => {
            const msg = `Coach, je t'envoie ma technique sur le ${exo.name || 'cet exercice'} 👇`;
            const safeName = (exo.name || '').replace(/"/g, '&quot;');
            const safeMsg = msg.replace(/"/g, '&quot;');
            return `
                <div class="check-technique-wrap">
                    <button type="button" class="btn-check-technique" data-wa-msg="${safeMsg}" aria-label="Enregistrer une vidéo et l’envoyer au coach pour vérifier ma technique sur ${safeName}">
                        <span class="btn-check-technique-icon" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        </span>
                        <span>Check ma technique</span>
                    </button>
                </div>`;
        })()
        : '';

    const restSec = parseInt(String(exo.rest).replace(/\D/g, ''), 10) || 60;
    const supersetRole = supersetRoleNum != null ? String(supersetRoleNum) : '';
    const altData = exo.alternative ? (typeof exo.alternative === 'string' ? { name: exo.alternative } : exo.alternative) : null;
    const altName = altData ? (altData.name || String(exo.alternative)) : '';
    const altIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
    const altBtnHtml = altData ? `<button type="button" class="btn-alternative" data-original-name="${(exo.name || '').replace(/"/g, '&quot;')}" data-alt-name="${altName.replace(/"/g, '&quot;')}" title="Remplacer par : ${altName}" aria-label="Remplacer par ${altName}">${altIconSvg}</button>` : '';
    const activeTimerHtml = isTimeBased ? `<button type="button" class="active-timer-btn" data-target-seconds="${targetSeconds}" aria-label="Lancer le chrono d'effort"><span class="active-timer-text">▶ Go</span></button>` : '';
    const warmupClass = isWarmupExercise ? ' exercise-warmup' : '';
    return `
    <div class="exercise-card open${warmupClass}" id="card-${index}" data-index="${index}"${supersetRole ? ` data-superset-role="${supersetRole}"` : ''}>
        <div class="exercise-header" role="button" tabindex="0" aria-expanded="true" aria-label="Afficher ou masquer les détails de l'exercice">
            <div>
                <div class="exercise-title-row"><span class="exercise-title">${exo.name}</span>${altBtnHtml}</div>
                <div class="rpe-badge-wrap"><span class="rpe-badge" title="RPE = Rate of Perceived Exertion : échelle 1-10 de l'effort ressenti (1=très facile, 10=maximum)">RPE: ${exo.rpe_target || '-'}</span><button type="button" class="btn-rpe-badge" aria-label="Aide échelle RPE">?</button></div>
            </div>
            <div class="toggle-icon">▼</div>
        </div>
        
        <div class="exercise-content">
            <div class="exercise-inner">
                ${mediaHtml}
                ${variationHtml}
                <div class="${gridClass} details-dynamic" data-card-index="${index}" data-reps="${repsData.replace(/"/g, '&quot;')}" data-rest="${restData.replace(/"/g, '&quot;')}" data-failure="${!!(exo.until_failure || exo.failure)}">
                    <div class="detail-box"><span class="detail-label">Série</span><span class="detail-value detail-serie-num">1/${exo.sets}</span></div>
                    <div class="detail-box"><span class="detail-label">Reps</span><span class="detail-value detail-reps">${repsDisplayInit}</span></div>
                    <div class="detail-box"><span class="detail-label">Repos</span><span class="detail-value detail-rest">${restDisplayInit}</span></div>
                    ${tempoHtml}
                    <button type="button" class="timer-btn" data-rest="${restSec}" aria-label="Chronomètre de repos (déclenché par les séries)">
                        <span class="timer-icon">⏱️</span><span class="timer-text">Repos</span>
                        <span class="timer-close" aria-label="Arrêter le chronomètre">×</span>
                    </button>
                    ${activeTimerHtml}
                </div>
                ${checkboxesHtml}
                ${exo.note_coach ? `<div class="coach-note">"${exo.note_coach}"</div>` : ''}
                <div class="client-input-zone">
                    <div class="input-row">
                        <span class="input-with-btn charge-input-wrap">
                            <label for="${idCharge}" class="charge-input-label">Charge (kg)</label>
                            <span class="charge-input-row">
                                <input type="text" id="${idCharge}" placeholder="—" value="${(exo.charge || exo.default_charge || '').toString().replace(/"/g, '&quot;')}" aria-label="Charge en kg">
                                <span class="charge-suffix">kg</span>
                            </span>
                        </span>
                        <span class="input-with-btn"><input type="number" id="${idRpe}" placeholder="RPE" min="1" max="10" aria-label="RPE ressenti" title="Échelle 1-10 de l'effort ressenti (1=facile, 10=maximum)"></span>
                    </div>
                    <input type="text" id="${idCom}" placeholder="Note..." aria-label="Note personnelle">
                </div>
                ${checkTechniqueHtml}
            </div>
        </div>
    </div>`;
}

function updateExerciseDetails(card) {
    const grid = card?.querySelector('.details-dynamic');
    if (!grid) return;
    const repsData = grid.dataset.reps;
    const restData = grid.dataset.rest;
    const isFailure = grid.dataset.failure === 'true';
    const checkboxes = card.querySelectorAll('.set-checkbox');
    let currentSetIndex = 0;
    for (let i = 0; i < checkboxes.length; i++) {
        if (!checkboxes[i].checked) { currentSetIndex = i; break; }
        currentSetIndex = i + 1;
    }
    const total = checkboxes.length;
    const serieNum = grid.querySelector('.detail-serie-num');
    const repsEl = grid.querySelector('.detail-reps');
    const restEl = grid.querySelector('.detail-rest');
    if (serieNum) serieNum.textContent = currentSetIndex < total ? `${currentSetIndex + 1}/${total}` : `${total}/${total}`;
    if (currentSetIndex >= total && repsEl) repsEl.textContent = isFailure ? "Jusqu'à échec" : '-';
    else if (repsEl && repsData) {
        try {
            const arr = JSON.parse(repsData);
            repsEl.textContent = isFailure ? "Jusqu'à échec" : (arr[currentSetIndex] || arr[arr.length - 1] || '-');
        } catch (_) { repsEl.textContent = '-'; }
    }
    let restDisplay = '60s';
    if (currentSetIndex >= total) { if (restEl) restEl.textContent = '-'; }
    else if (restData) {
        try {
            const arr = JSON.parse(restData);
            restDisplay = arr[currentSetIndex] || arr[arr.length - 1] || '60s';
            if (restEl) restEl.textContent = restDisplay;
        } catch (_) { if (restEl) restEl.textContent = '60s'; }
    }
    const restSec = parseInt(String(restDisplay).replace(/\D/g, ''), 10) || 60;
    const timerBtn = card.querySelector('.timer-btn');
    if (timerBtn) timerBtn.dataset.rest = restSec;
}

function updateAllExerciseDetails() {
    document.querySelectorAll('.exercise-card').forEach(card => updateExerciseDetails(card));
}

function updateSupersetHighlight(shouldScrollToCurrent) {
    document.querySelectorAll('.set-wrapper').forEach(w => w.classList.remove('superset-next-set'));
    document.querySelectorAll('.superset-block').forEach((block) => {
        const cards = Array.from(block.querySelectorAll('.exercise-card[data-superset-role]'))
            .sort((a, b) => parseInt(a.dataset.supersetRole, 10) - parseInt(b.dataset.supersetRole, 10));
        const numCards = cards.length;
        if (numCards < 2) return;
        const checkboxes = block.querySelectorAll('.set-checkbox');
        const totalChecked = block.querySelectorAll('.set-checkbox:checked').length;
        const totalSets = checkboxes.length;
        cards.forEach(c => c.classList.remove('superset-current'));
        if (totalChecked < totalSets) {
            const currentIndex = totalChecked % numCards;
            const currentCard = cards[currentIndex];
            if (currentCard) {
                currentCard.classList.add('superset-current');
                if (shouldScrollToCurrent && totalChecked >= 1) {
                    currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            const nextCardIndex = totalChecked % numCards;
            const nextSetIndex = Math.floor(totalChecked / numCards) + 1;
            const nextCard = cards[nextCardIndex];
            if (nextCard) {
                const nextWrapper = nextCard.querySelector(`.set-checkbox[data-set-num="${nextSetIndex}"]`)?.closest('.set-wrapper');
                if (nextWrapper && !nextWrapper.querySelector('.set-checkbox:checked')) {
                    nextWrapper.classList.add('superset-next-set');
                }
            }
        }
    });
}

function checkSetAndCollapse(checkbox, cardIndex, setNumber, totalSets) {
    if (sessionStartTime === null) sessionStartTime = Date.now();
    updateProgress(true); 
    saveData(); 
    updateSupersetHighlight(true);
    if (document.body.classList.contains('guided-mode')) {
        guidedViewIndex = getFirstIncompleteIndex();
        updateGuidedMode();
    }
    const card = document.getElementById(`card-${cardIndex}`);
    if (card) updateExerciseDetails(card);

    if (checkbox.checked && setNumber === totalSets) {
        const card = document.getElementById(`card-${cardIndex}`);
        if (card && card.classList.contains('open')) {
            setTimeout(() => { 
                const header = card.querySelector('.exercise-header');
                if(header) toggleCard(header); 
            }, 300);
        }
        const container = document.getElementById('workout-container');
        const cards = container ? Array.from(container.querySelectorAll('.exercise-card')) : [];
        const idx = cards.findIndex(c => c.id === `card-${cardIndex}`);
        const nextCard = idx >= 0 && idx < cards.length - 1 ? cards[idx + 1] : null;
        if (nextCard) {
            const nextHeader = nextCard.querySelector('.exercise-header');
            const target = nextHeader || nextCard;
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            }, 900);
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
        sessionEndTime = Date.now();
        if (currentSessionDate) markSessionCompleted(currentSessionId, currentSessionDate);
        saveChargeHistory();
        fireConfetti();
        document.body.classList.add('modal-open');
        const overlay = document.getElementById('completion-overlay');
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        injectNutritionCard();
        const whatsappBtn = document.querySelector('#whatsapp-bottom button');
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

function getChargeHistory() {
    try {
        return JSON.parse(localStorage.getItem(KEY_CHARGE_HISTORY) || '[]');
    } catch { return []; }
}

function saveChargeHistory() {
    const history = getChargeHistory();
    const session = globalData && globalData.sessions ? globalData.sessions.find(s => (s.id === currentSessionId) || (`session_${globalData.sessions.indexOf(s)}` === currentSessionId)) : null;
    if (!session || !session.exercises) return;
    const dateStr = currentSessionDate || new Date().toISOString().slice(0, 10);
    session.exercises.forEach((exo, idx) => {
        if (exo.type === 'section') return;
        const idCharge = `charge-${currentSessionId}-${idx}`;
        const chargeEl = document.getElementById(idCharge);
        const val = chargeEl ? String(chargeEl.value || '').trim() : '';
        const numVal = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (val && !isNaN(numVal)) {
            history.push({ sessionId: currentSessionId, exoIdx: idx, exoName: exo.name, charge: numVal, date: dateStr });
        }
    });
    while (history.length > 100) history.shift();
    localStorage.setItem(KEY_CHARGE_HISTORY, JSON.stringify(history));
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
    btn.classList.add('timer-floating');
    const timerText = btn.querySelector('.timer-text');
    timerText.textContent = `Repos : ${timeLeft}s`;
    const interval = setInterval(() => {
        timeLeft--;
        timerText.textContent = `Repos : ${timeLeft}s`;
        if (timeLeft > 0 && timeLeft <= 3) playBeep();
        if (timeLeft <= 0) {
            clearInterval(interval);
            btn.classList.remove('active');
            btn.classList.remove('timer-floating');
            btn.dataset.timerInterval = '';
            timerText.textContent = "Terminé !";
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
    btn.dataset.timerInterval = interval;
}

function stopTimer(btn) {
    const intervalId = btn.dataset.timerInterval;
    if (intervalId) clearInterval(parseInt(intervalId, 10));
    btn.dataset.timerInterval = '';
    btn.classList.remove('active');
    btn.classList.remove('timer-floating');
    const timerText = btn.querySelector('.timer-text');
    if (timerText) timerText.textContent = "Lancer le repos";
}

function startActiveTimer(btn) {
    if (btn.classList.contains('active')) return;
    const targetSec = parseInt(btn.dataset.targetSeconds, 10) || 45;
    let elapsed = 0;
    btn.classList.add('active');
    const textEl = btn.querySelector('.active-timer-text');
    const interval = setInterval(() => {
        elapsed++;
        if (textEl) textEl.textContent = `${elapsed}s`;
        const remaining = targetSec - elapsed;
        if (remaining > 0 && remaining <= 3) playBeep();
        if (elapsed >= targetSec) {
            clearInterval(interval);
            btn.classList.remove('active');
            if (textEl) textEl.textContent = 'Terminé !';
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
    btn.dataset.activeTimerInterval = interval;
        
    if (textEl) textEl.textContent = '0s';
}

function stopActiveTimer(btn) {
    const id = btn.dataset.activeTimerInterval;
    if (id) clearInterval(parseInt(id, 10));
    btn.classList.remove('active');
    const textEl = btn.querySelector('.active-timer-text');
    if (textEl) textEl.textContent = '▶ Go';
}

function showWarmupGenerator(chargeId, exoName) {
    const input = document.getElementById(chargeId);
    const target = parseInt(String(input?.value || '').replace(/\D/g, ''), 10);
    if (!target || target < 20) {
        showToast('Saisis ta charge de travail (kg) pour générer l\'échauffement.');
        return;
    }
    const bar = 20;
    const s1 = Math.round(target * 0.4 / 2.5) * 2.5 || bar;
    const s2 = Math.round(target * 0.6 / 2.5) * 2.5;
    const s3 = Math.round(target * 0.8 / 2.5) * 2.5;
    const lines = [
        `Barre à vide (${bar}kg) x 10 reps`,
        `${s1}kg x 8 reps`,
        `${s2}kg x 5 reps`,
        `${s3}kg x 3 reps`,
        `➜ Go ${target}kg !`
    ];
    let el = document.getElementById('warmup-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'warmup-overlay';
        el.className = 'warmup-overlay';
        el.innerHTML = '<div class="warmup-modal"><button type="button" class="warmup-close">×</button><h3></h3><ul class="warmup-list"></ul></div>';
        document.body.appendChild(el);
        el.querySelector('.warmup-close').onclick = () => el.classList.remove('active');
        el.onclick = (e) => { if (e.target === el) el.classList.remove('active'); };
    }
    el.querySelector('h3').textContent = `🔥 Échauffement ${exoName}`;
    el.querySelector('.warmup-list').innerHTML = lines.map(l => `<li>${l}</li>`).join('');
    el.classList.add('active');
}

function showRpeTooltip(btn) {
    const existing = document.getElementById('rpe-tooltip-popover');
    if (existing) { existing.remove(); return; }
    const pop = document.createElement('div');
    pop.id = 'rpe-tooltip-popover';
    pop.className = 'rpe-tooltip-popover';
    pop.innerHTML = `
        <div class="rpe-scale-title">Échelle RPE (effort ressenti)</div>
        <div class="rpe-scale-bar"><span class="rpe-seg rpe-seg-low"></span><span class="rpe-seg rpe-seg-mid"></span><span class="rpe-seg rpe-seg-high"></span></div>
        <div class="rpe-scale-labels"><span>1-4</span><span>5-6</span><span>7-8</span><span>9-10</span></div>
        <div class="rpe-scale-items">
            <div class="rpe-scale-item rpe-green"><span class="rpe-dot rpe-dot-green"></span>RPE 5-6 : Échauffement / Facile</div>
            <div class="rpe-scale-item rpe-yellow"><span class="rpe-dot rpe-dot-yellow"></span>RPE 7-8 : Difficile (reste 2-3 reps)</div>
            <div class="rpe-scale-item rpe-red"><span class="rpe-dot rpe-dot-red"></span>RPE 9-10 : Échec ou limite</div>
        </div>
        <button type="button" class="rpe-tooltip-close">Fermer</button>
    `;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    pop.style.left = Math.min(rect.left, vw - 320) + 'px';
    pop.style.top = (rect.bottom + 8) + 'px';
    document.body.appendChild(pop);
    const close = () => { pop.remove(); document.removeEventListener('click', closeOut); document.removeEventListener('touchstart', closeOut); };
    const closeOut = (e) => { if (!pop.contains(e.target) && e.target !== btn) close(); };
    setTimeout(() => { document.addEventListener('click', closeOut); document.addEventListener('touchstart', closeOut); }, 50);
    pop.querySelector('.rpe-tooltip-close').onclick = (e) => { e.stopPropagation(); close(); };
}

function swapExerciseAlternative(btn) {
    const card = btn.closest('.exercise-card');
    const titleEl = card?.querySelector('.exercise-title');
    if (!titleEl) return;
    const orig = btn.dataset.originalName || '';
    const alt = btn.dataset.altName || '';
    const current = titleEl.textContent.trim();
    titleEl.textContent = (current === orig || !btn.dataset.showingAlt) ? alt : orig;
    btn.dataset.showingAlt = (current === orig || !btn.dataset.showingAlt) ? '1' : '';
}

function buildSessionReport() {
    const clientNameEl = document.getElementById('client-name');
    const clientName = clientNameEl ? clientNameEl.innerText.replace(/^Bonjour\s+|\s*!$/g, '').trim() : '';
    let sessionName = "Séance";
    if (globalData && globalData.sessions) {
        const s = globalData.sessions.find(x => (x.id === currentSessionId) || (`session_${globalData.sessions.indexOf(x)}` === currentSessionId));
        if (s) sessionName = s.name || sessionName;
    }

    const exercises = [];
    document.querySelectorAll('.exercise-card').forEach((card) => {
        const originalIndex = card.dataset.index;
        const title = card.querySelector('.exercise-title')?.innerText || '';
        const checkboxes = card.querySelectorAll('.set-checkbox');
        const setsTotal = checkboxes.length;
        const setsCompleted = card.querySelectorAll('.set-checkbox:checked').length;
        const idCharge = `charge-${currentSessionId}-${originalIndex}`;
        const idRpe = `rpe-${currentSessionId}-${originalIndex}`;
        const idCom = `comment-${currentSessionId}-${originalIndex}`;
        exercises.push({
            name: title,
            setsTotal,
            setsCompleted,
            charge: document.getElementById(idCharge)?.value?.trim() || null,
            rpe: document.getElementById(idRpe)?.value?.trim() || null,
            note: document.getElementById(idCom)?.value?.trim() || null
        });
    });

    const report = {
        client: clientName,
        sessionId: currentSessionId,
        sessionName,
        date: currentSessionDate || new Date().toISOString().slice(0, 10),
        exercises,
        bilan: {
            muscle: document.getElementById('score-muscle')?.value || null,
            muscleCom: document.getElementById('com-muscle')?.value?.trim() || null,
            cardio: document.getElementById('score-cardio')?.value || null,
            cardioCom: document.getElementById('com-cardio')?.value?.trim() || null,
            fatigue: document.getElementById('score-fatigue')?.value || null,
            fatigueCom: document.getElementById('com-fatigue')?.value?.trim() || null,
            sommeil: document.getElementById('score-sleep')?.value || null,
            sommeilCom: document.getElementById('com-sleep')?.value?.trim() || null
        },
        coachNote: document.getElementById('coach-note-free')?.value?.trim() || null
    };
    if (sessionStartTime && sessionEndTime) {
        const mins = Math.round((sessionEndTime - sessionStartTime) / 60000);
        report.durationMinutes = mins;
    }
    return report;
}

function sendToWhatsapp() {
    const report = buildSessionReport();
    let msg = `*Rapport Final - ${document.getElementById('client-name').innerText}*\n`;
    msg += `📂 *${report.sessionName}*\n`;
    if (report.durationMinutes != null) msg += `⏱️ Durée : ${report.durationMinutes} min\n`;
    msg += `\n`;

    report.exercises.forEach((ex) => {
        msg += `🔹 *${ex.name}*\n`;
        msg += `   Séries : ${ex.setsCompleted}/${ex.setsTotal}\n`;
        if (ex.charge) msg += `   ⚖️ ${ex.charge}kg\n`;
        if (ex.rpe) msg += `   🔥 RPE ${ex.rpe}\n`;
        if (ex.note) msg += `   📝 ${ex.note}\n`;
    });

    const b = report.bilan;
    if (b.muscle || b.cardio || b.fatigue || b.sommeil) {
        msg += `\n📊 *BILAN GLOBAL*\n`;
        if (b.muscle) msg += `💪 Muscle: ${b.muscle}/10${b.muscleCom ? ' (' + b.muscleCom + ')' : ''}\n`;
        if (b.cardio) msg += `🫀 Cardio: ${b.cardio}/10${b.cardioCom ? ' (' + b.cardioCom + ')' : ''}\n`;
        if (b.fatigue) msg += `😫 Fatigue: ${b.fatigue}/10${b.fatigueCom ? ' (' + b.fatigueCom + ')' : ''}\n`;
        if (b.sommeil) msg += `💤 Sommeil: ${b.sommeil}/10${b.sommeilCom ? ' (' + b.sommeilCom + ')' : ''}\n`;
    }
    if (report.coachNote) {
        setCoachNote(report.coachNote);
        msg += `\n💬 *Message pour toi:*\n${report.coachNote}\n`;
    }

    msg += `\n--- BILAN JSON ---\n${JSON.stringify(report, null, 2)}\n---\nEnvoyé depuis mon App Coaching 🏋️‍♀️`;

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

function injectNutritionCard() {
    const slot = document.getElementById('nutrition-card-slot');
    if (!slot) return;
    slot.innerHTML = "";
    const session = globalData && globalData.sessions
        ? globalData.sessions.find(s => (s.id === currentSessionId) || (`session_${globalData.sessions.indexOf(s)}` === currentSessionId))
        : null;
    if (session && session.nutrition_tip && String(session.nutrition_tip).trim()) {
        const card = document.createElement('div');
        card.className = 'nutrition-card';
        card.innerHTML = `<span class="nutrition-icon" aria-hidden="true">🥑</span><p>${String(session.nutrition_tip).trim()}</p>`;
        slot.appendChild(card);
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
    if (whatsappBtn) document.getElementById('whatsapp-bottom').appendChild(whatsappBtn);
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
    const history = getChargeHistory();
    const session = globalData.sessions.find(s => (s.id === currentSessionId) || s.id === currentSessionId);
    if (!session || !session.exercises) { panel.innerHTML = ''; return; }
    let html = '<p class="progression-intro">Charges enregistrées pour cette séance :</p><ul class="progression-list">';
    let hasAny = false;
    session.exercises.forEach((exo, idx) => {
        if (exo.type === 'section') return;
        const idCharge = `charge-${currentSessionId}-${idx}`;
        const val = saved[idCharge];
        const exoHistory = history.filter(h => h.sessionId === currentSessionId && h.exoIdx === idx).slice(-10);
        const hasHistory = exoHistory.length > 0;
        if (val || hasHistory) hasAny = true;
        if (!val && !hasHistory) return;
        const displayVal = val || (hasHistory ? exoHistory[exoHistory.length - 1].charge : '-');
        const maxCharge = hasHistory ? Math.max(...exoHistory.map(h => h.charge)) : 1;
        let sparkHtml = '';
        if (hasHistory && maxCharge > 0) {
            sparkHtml = '<div class="progression-sparkline">' + exoHistory.map(h => {
                const pct = Math.round((h.charge / maxCharge) * 100);
                return `<span class="progression-sparkline-bar" style="height:${Math.max(8, pct)}%" title="${h.date}: ${h.charge}kg"></span>`;
            }).join('') + '</div>';
        }
        html += `<li class="progression-item"><span class="progression-item-name">${exo.name}</span> : ${displayVal} kg${sparkHtml}</li>`;
    });
    html += '</ul>';
    if (!hasAny)
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
        localStorage.removeItem(KEY_CHARGE_HISTORY);
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

let deferredInstallPrompt = null;
function initInstallPrompt() {
    const banner = document.getElementById('install-banner');
    const btnInstall = document.getElementById('btn-install-app');
    const btnDismiss = document.getElementById('btn-dismiss-install');
    if (!banner || !btnInstall || !btnDismiss) return;
    if (isInstallDismissed() || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (!isInstallDismissed()) banner.hidden = false;
    });
    btnInstall.addEventListener('click', () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((r) => {
            if (r.outcome === 'accepted') banner.hidden = true;
            deferredInstallPrompt = null;
        });
    });
    btnDismiss.addEventListener('click', () => {
        setInstallDismissed();
        banner.hidden = true;
    });
}

let guidedViewIndex = 0;
function getFirstIncompleteIndex() {
    const cards = document.querySelectorAll('#workout-container .exercise-card');
    for (let i = 0; i < cards.length; i++) {
        const cb = cards[i].querySelector('.set-checkbox:not(:checked)');
        if (cb) return i;
    }
    return Math.max(0, cards.length - 1);
}

function updateGuidedMode() {
    const on = document.body.classList.contains('guided-mode');
    const nav = document.getElementById('guided-nav');
    const cards = document.querySelectorAll('#workout-container .exercise-card');
    if (!on || cards.length === 0) {
        if (nav) nav.hidden = true;
        cards.forEach(c => c.classList.remove('guided-current'));
        return;
    }
    guidedViewIndex = Math.min(guidedViewIndex, cards.length - 1);
    cards.forEach((c, i) => c.classList.toggle('guided-current', i === guidedViewIndex));
    if (nav) {
        nav.hidden = false;
        const btnPrev = document.getElementById('btn-guided-prev');
        const btnNext = document.getElementById('btn-guided-next');
        if (btnPrev) btnPrev.disabled = guidedViewIndex <= 0;
        if (btnNext) btnNext.disabled = guidedViewIndex >= cards.length - 1;
    }
}

function initGuidedMode() {
    const btn = document.getElementById('btn-guided-mode');
    const btnPrev = document.getElementById('btn-guided-prev');
    const btnNext = document.getElementById('btn-guided-next');
    if (!btn) return;
    if (isGuidedMode()) {
        document.body.classList.add('guided-mode');
        guidedViewIndex = 0;
        setTimeout(() => { guidedViewIndex = getFirstIncompleteIndex(); updateGuidedMode(); }, 100);
    }
    btn.addEventListener('click', () => {
        const on = !document.body.classList.contains('guided-mode');
        document.body.classList.toggle('guided-mode', on);
        setGuidedMode(on);
        if (on) updateGuidedMode();
        else {
            const nav = document.getElementById('guided-nav');
            if (nav) nav.hidden = true;
            document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('guided-current'));
        }
        btn.textContent = on ? '◎ Vue complète' : '◎ Guidé';
        btn.setAttribute('title', on ? 'Revenir à la vue complète' : 'Mode séance guidée');
    });
    if (btnPrev) btnPrev.addEventListener('click', () => {
        if (guidedViewIndex > 0) {
            guidedViewIndex--;
            updateGuidedMode();
            document.querySelector('.exercise-card.guided-current')?.scrollIntoView({ behavior: 'smooth' });
        }
    });
    if (btnNext) btnNext.addEventListener('click', () => {
        const cards = document.querySelectorAll('#workout-container .exercise-card');
        if (guidedViewIndex < cards.length - 1) {
            guidedViewIndex++;
            updateGuidedMode();
            document.querySelector('.exercise-card.guided-current')?.scrollIntoView({ behavior: 'smooth' });
        }
    });
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
    if (e.target.closest('#whatsapp-bottom button')) { sendToWhatsapp(); return; }
    const recoveryBtn = e.target.closest('.btn-recovery-video');
    if (recoveryBtn) {
        const url = recoveryBtn.getAttribute('data-recovery-url') || DEFAULT_RECOVERY_VIDEO_URL;
        if (url) window.open(url, '_blank');
        return;
    }
    if (e.target.closest('[data-reset-session]')) { resetCurrentSession(); return; }
    const checkTechniqueBtn = e.target.closest('.btn-check-technique');
    if (checkTechniqueBtn) {
        const msg = checkTechniqueBtn.getAttribute('data-wa-msg') || '';
        if (msg) window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        return;
    }
    const altBtn = e.target.closest('.btn-alternative');
    if (altBtn) { e.stopPropagation(); swapExerciseAlternative(altBtn); return; }
    const warmupLabel = e.target.closest('.set-label-warmup');
    if (warmupLabel) {
        const wrapper = warmupLabel.closest('.set-wrapper-warmup');
        if (wrapper) { showWarmupGenerator(wrapper.dataset.chargeId, wrapper.dataset.exoName || 'cet exercice'); }
        return;
    }
    const rpeBtn = e.target.closest('.btn-rpe-badge');
    if (rpeBtn) { e.stopPropagation(); showRpeTooltip(rpeBtn); return; }
    const activeTimerBtn = e.target.closest('.active-timer-btn');
    if (activeTimerBtn) { e.stopPropagation(); startActiveTimer(activeTimerBtn); return; }
    const header = e.target.closest('.exercise-header');
    if (header) { toggleCard(header); return; }
    const timerClose = e.target.closest('.timer-close');
    if (timerClose) {
        const timerBtn = timerClose.closest('.timer-btn');
        if (timerBtn && timerBtn.classList.contains('active')) {
            e.stopPropagation();
            stopTimer(timerBtn);
        }
        return;
    }
    const timerBtn = e.target.closest('.timer-btn');
    if (timerBtn && timerBtn.dataset.rest !== undefined && !e.target.closest('.timer-close')) {
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
    if (e.target.checked) {
        const card = document.getElementById('card-' + cardIndex);
        const timerBtn = card && card.querySelector('.timer-btn');
        if (timerBtn && timerBtn.dataset.rest && !timerBtn.classList.contains('active')) {
            startTimer(timerBtn, parseInt(timerBtn.dataset.rest, 10) || 60);
        }
    }
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

function initHeaderMenu() {
    const menuBtn = document.getElementById('header-menu-btn');
    const actions = document.getElementById('header-actions');
    if (!menuBtn || !actions) return;
    menuBtn.addEventListener('click', function () {
        const open = actions.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open);
        menuBtn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    document.body.addEventListener('click', function (e) {
        if (actions.classList.contains('open') && !actions.contains(e.target) && !menuBtn.contains(e.target)) {
            actions.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
            menuBtn.setAttribute('aria-label', 'Ouvrir le menu');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initDarkMode(); initCopyLink(); initHeaderMenu(); });
} else {
    initDarkMode();
    initCopyLink();
    initHeaderMenu();
}