// --- CONFIGURATION ---
const COACH_PHONE_NUMBER = "33662110786"; // TON NUMÉRO
const COACH_NAME = "David";
const DEFAULT_RECOVERY_VIDEO_URL = null; // Stretching générique 10min
const APP_VERSION = "2.7.3";
const PAST_DAYS = 1;
const DAYS_AHEAD = 21;

const urlParams = new URLSearchParams(window.location.search);
const urlClient = urlParams.get('client');
// Identifiant client : d'abord le paramètre d'URL, sinon le dernier client utilisé sur cet appareil, sinon "demo"
const clientID = urlClient || localStorage.getItem('fitapp_last_client') || 'demo';
// Si un client explicite est passé dans l'URL, on le mémorise pour les prochaines ouvertures (PWA, lien sans ?client=)
if (urlClient) {
    try {
        localStorage.setItem('fitapp_last_client', urlClient);
    } catch (_) {
        // ignore
    }
}

let globalData = null;
let currentSessionId = "default";
let currentSessionDate = "";
let sessionStartTime = null;
let sessionEndTime = null;
let moveSessionMode = false;
let moveSessionSourceId = null;
let moveSessionSourceIndex = -1;
// Flags en mémoire pour ne pas spammer la bannière d'encouragement
let encouragementShown75 = false;

// Petits messages d'encouragement possibles (un sera choisi au hasard)
const ENCOURAGEMENT_MESSAGES = [
    "Tu es quasiment au bout, reste dans le mouvement.",
    "Belle constance, termine cette séance comme tu l’as commencée.",
    "Encore quelques séries et tu valides une vraie victoire.",
    "Reste focus sur tes répétitions, tout compte.",
    "Tu construis des habitudes solides à chaque série que tu termines."
];

function getRandomEncouragementMessage() {
    if (!Array.isArray(ENCOURAGEMENT_MESSAGES) || ENCOURAGEMENT_MESSAGES.length === 0) {
        return "Tu es quasiment au bout, reste dans le mouvement.";
    }
    const index = Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length);
    return ENCOURAGEMENT_MESSAGES[index];
}

// --- PARAMÈTRES (localStorage) ---
const KEY_SOUND = 'fitapp_sound_' + clientID;
const KEY_THEME = 'fitapp_theme_' + clientID;
const KEY_COACH_NOTE = 'fitapp_coach_note_' + clientID;
const KEY_NOTIF_DAY = 'fitapp_notif_day_' + clientID;
const KEY_NOTIF_ENABLED = 'fitapp_notif_enabled_' + clientID;
const KEY_INSTALL_DISMISSED = 'fitapp_install_dismissed_' + clientID;
const KEY_GUIDED_MODE = 'fitapp_guided_' + clientID;
const KEY_CHARGE_HISTORY = 'fitapp_charge_history_' + clientID;
const KEY_SESSION_DATE_OVERRIDES = 'fitapp_session_dates_' + clientID;
const KEY_COUNTERS = 'fitapp_counters_' + clientID;
const KEY_MILESTONES = 'fitapp_milestones_' + clientID;
const KEY_TRAINING_SECONDS = 'fitapp_training_seconds_' + clientID;
const KEY_MENSURATIONS = 'fitapp_mensurations_' + clientID;
const KEY_POIDS = 'fitapp_poids_' + clientID;
const KEY_VETEMENT_TEST = 'fitapp_vetement_test_' + clientID;
const KEY_SUIVI_HEADER = 'fitapp_suivi_header_' + clientID;
const SUIVI_HISTORY_MAX = 15;
const SUIVI_HEADER_MAX = 3;

function getSettingSound() { return localStorage.getItem(KEY_SOUND) !== '0'; }
function getSettingLoudBeep() { return localStorage.getItem('fitapp_loud_beep_' + clientID) === '1'; }
function setSettingSound(on) { localStorage.setItem(KEY_SOUND, on ? '1' : '0'); }
function setSettingLoudBeep(on) { localStorage.setItem('fitapp_loud_beep_' + clientID, on ? '1' : '0'); }
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
function getSessionDateOverrides() {
    try { return JSON.parse(localStorage.getItem(KEY_SESSION_DATE_OVERRIDES) || '{}') || {}; }
    catch { return {}; }
}
function setSessionDateOverrides(map) {
    localStorage.setItem(KEY_SESSION_DATE_OVERRIDES, JSON.stringify(map || {}));
}
function setSessionDateOverride(sessionId, dateStr) {
    if (!sessionId || !dateStr) return;
    const map = getSessionDateOverrides();
    map[sessionId] = dateStr;
    setSessionDateOverrides(map);
}

/** Échappe les caractères HTML pour afficher du texte sans risque XSS dans innerHTML. */
function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

// --- EXPORT VERS AGENDA (Google, Apple / .ics) ---
function getCurrentSessionCalendarData() {
    if (!globalData || !globalData.sessions || !currentSessionDate) return null;
    const session = globalData.sessions.find(s => (s.id || '').toString() === (currentSessionId || '').toString())
        || globalData.sessions.find((_, i) => `session_${i}` === currentSessionId);
    const name = (session && session.name) ? session.name : 'Séance';
    const intro = session?.session_intro || session?.objectives || '';
    const details = [globalData.programTitle, intro].filter(Boolean).join('\n\n');
    return { name, dateStr: currentSessionDate, details };
}

function getGoogleCalendarAddUrl(sessionName, dateStr, details, durationMinutes) {
    if (!dateStr || !sessionName) return null;
    const duration = durationMinutes || 60;
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d, 10, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const format = (date) => {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${Y}${M}${D}T${h}${min}${s}`;
    };
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: sessionName,
        dates: `${format(start)}/${format(end)}`
    });
    if (details) params.set('details', details);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getIcsContent(sessionName, dateStr, details, durationMinutes) {
    const duration = durationMinutes || 60;
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d, 10, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const format = (date) => {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${Y}${M}${D}T${h}${min}${s}`;
    };
    const escapeIcs = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const summary = escapeIcs(sessionName);
    const description = escapeIcs(details || '');
    const uid = `seance-${dateStr}-${Date.now()}@mon-coaching`;
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mon Coaching//FR',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTAMP:' + dtstamp,
        'DTSTART:' + format(start),
        'DTEND:' + format(end),
        'SUMMARY:' + summary,
        (description ? 'DESCRIPTION:' + description : ''),
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
}

function downloadIcsFile(sessionName, dateStr, details) {
    const ics = getIcsContent(sessionName, dateStr, details, 60);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Seance-${dateStr}.ics`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openAddToCalendarGoogle() {
    const data = getCurrentSessionCalendarData();
    if (!data) { showToast('Ouvre une séance pour l\'ajouter à ton agenda.'); return; }
    const url = getGoogleCalendarAddUrl(data.name, data.dateStr, data.details || undefined, 60);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function openAddToCalendarApple() {
    const data = getCurrentSessionCalendarData();
    if (!data) { showToast('Ouvre une séance pour l\'ajouter à ton agenda.'); return; }
    const ics = getIcsContent(data.name, data.dateStr, data.details, 60);
    if (isIOS()) {
        // Sur iOS, ouvrir directement le contenu ICS pour déclencher la feuille "Ajouter à Calendrier"
        const url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
        window.location.href = url;
    } else {
        // Comportement classique : téléchargement du fichier .ics
        downloadIcsFile(data.name, data.dateStr, data.details);
        showToast('Fichier .ics téléchargé. Ouvre-le pour l\'ajouter à ton agenda.');
    }
}

function showAddToCalendarMenu(anchorEl) {
    const data = getCurrentSessionCalendarData();
    if (!data) {
        showToast('Ouvre une séance pour l\'ajouter à ton agenda.');
        return;
    }
    const existing = document.getElementById('add-to-calendar-popover');
    if (existing) { existing.remove(); return; }

    const pop = document.createElement('div');
    pop.id = 'add-to-calendar-popover';
    pop.className = 'add-to-calendar-popover';
    pop.setAttribute('role', 'menu');
    pop.innerHTML = `
        <button type="button" class="add-to-calendar-option" data-calendar="google" role="menuitem">Google Agenda</button>
        <button type="button" class="add-to-calendar-option" data-calendar="apple" role="menuitem">Apple Calendrier</button>
    `;

    const rect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    pop.style.left = Math.min(rect.left, vw - 220) + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';

    const close = () => {
        pop.remove();
        document.removeEventListener('click', closeOut);
        document.removeEventListener('touchstart', closeOut);
        const btn = document.getElementById('btn-add-to-agenda');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    };
    const closeOut = (e) => {
        if (!pop.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) close();
    };

    pop.querySelectorAll('.add-to-calendar-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            if (opt.dataset.calendar === 'google') openAddToCalendarGoogle();
            else if (opt.dataset.calendar === 'apple') openAddToCalendarApple();
            close();
        });
    });

    document.body.appendChild(pop);
    document.getElementById('header-actions')?.classList.remove('open');
    document.getElementById('header-menu-btn')?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { document.addEventListener('click', closeOut); document.addEventListener('touchstart', closeOut); }, 10);
    const btn = document.getElementById('btn-add-to-agenda');
    if (btn) btn.setAttribute('aria-expanded', 'true');
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
    document.getElementById('workout-container').innerHTML = `<div class="error-message" role="alert"><p>${escapeHtml(message)}</p></div>`;
    document.getElementById('calendar-strip').innerHTML = "";
    const wrap = document.getElementById('calendar-wrap');
    if (wrap) wrap.classList.remove('collapsed');
    document.getElementById('next-session').innerHTML = "";
    const goalEl = document.getElementById('weekly-goal-banner');
    if (goalEl) goalEl.innerHTML = "";
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
        renderSession(0, new Date().toISOString().slice(0, 10));
        updateWeekAndNextSession(globalData.sessions);
    }
    initBreathingModal();
    renderCoachSignature();
    renderProgressionPanel();
    initFocusMode();
    initSettings();
    initProgressionToggle();
    initSuiviModal();
    renderSuiviHeaderBar();
    initInstallPrompt();
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
    const overrides = getSessionDateOverrides();
    for (let i = 1; i <= DAYS_AHEAD; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const y = date.getFullYear(), mo = String(date.getMonth() + 1).padStart(2, '0'), da = String(date.getDate()).padStart(2, '0');
        const dateString = `${y}-${mo}-${da}`;
        const idx = sessions.findIndex((s, idxSession) => {
            const sid = s.id || `session_${idxSession}`;
            const overrideDate = overrides[sid];
            if (overrideDate) return overrideDate === dateString;
            return s.date === dateString || (s.day && s.day.toLowerCase() === dayMap[date.getDay()]);
        });
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
    const nextEl = document.getElementById('next-session');
    const goalEl = document.getElementById('weekly-goal-banner');
    const next = getNextSessionInfo(sessions);
    if (nextEl) {
        if (next) nextEl.innerHTML = `Prochaine séance : <strong>${escapeHtml(next.dayName)} ${escapeHtml(next.dateNum)}</strong> — ${escapeHtml(next.name)}`;
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
}

// --- CALENDRIER ---
function shortSessionName(name) {
    if (!name) return "";
    return name.replace(/^[^\w]*[\s:]/, "").trim().slice(0, 12) || name.slice(0, 12);
}

function renderCalendar(sessions, skipAutoSelect) {
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

        const overrides = getSessionDateOverrides();
        const sessionIndex = sessions.findIndex((s, idx) => {
            const sid = s.id || `session_${idx}`;
            const overrideDate = overrides[sid];
            if (overrideDate) return overrideDate === dateString;
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
        dayEl.setAttribute('aria-label', hasSession ? `Séance du ${escapeHtml(dayNameFR)} ${escapeHtml(dateNum)} : ${escapeHtml(sessionShortName || session.name)}` : `Repos le ${escapeHtml(dayNameFR)} ${escapeHtml(dateNum)}`);
        dayEl.dataset.sessionIndex = hasSession ? String(sessionIndex) : '';
        dayEl.dataset.dateString = dateString;
        dayEl.dataset.dayName = dayNameFR + " " + dateNum;
        dayEl.dataset.isToday = (i === 0) ? '1' : '0';

        dayEl.innerHTML = `
            <span class="day-name">${dayNameFR.substring(0, 3).toUpperCase()}</span>
            <span class="day-date">${dateNum}</span>
            ${sessionShortName ? `<span class="day-session-name" title="${escapeHtml((session && session.name) || '')}">${escapeHtml(sessionShortName)}</span>` : ""}
        `;

        dayEl.addEventListener('click', () => {
            if (moveSessionMode && globalData && globalData.sessions) {
                // Mode déplacement de séance : on ne peut choisir qu'un jour sans autre séance
                const sessionsList = globalData.sessions;
                const hasOtherSession = sessionsList.some((s, idxSession) => {
                    const sid = s.id || `session_${idxSession}`;
                    if (!moveSessionSourceId || sid === moveSessionSourceId) return false;
                    const overrideDate = overrides[sid];
                    if (overrideDate) return overrideDate === dateString;
                    if (s.date) return s.date === dateString;
                    if (s.day) return s.day.toLowerCase() === dayNameFR;
                    return false;
                });
                if (hasOtherSession) {
                    showToast('Une séance est déjà prévue ce jour-là.');
                    return;
                }
                // Déplacer la séance sélectionnée vers cette nouvelle date
                const sid = moveSessionSourceId;
                const sourceIndex = moveSessionSourceIndex;
                if (sid != null && sourceIndex != null && sourceIndex >= 0) {
                    setSessionDateOverride(sid, dateString);
                    moveSessionMode = false;
                    moveSessionSourceId = null;
                    moveSessionSourceIndex = -1;
                    document.body.classList.remove('calendar-move-mode');
                    renderCalendar(sessionsList, true);
                    syncCalendarActiveToDate(dateString);
                    renderSession(sourceIndex, dateString);
                    updateWeekAndNextSession(sessionsList);
                }
                return;
            }
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
            dayEl.classList.add('active');
            if (hasSession) renderSession(sessionIndex, dateString);
            else showRestDay(dayNameFR + " " + dateNum);
        });

        if (i === 0) todayEl = dayEl;
        calendarContainer.appendChild(dayEl);
    }

    if (todayEl && !skipAutoSelect) setTimeout(() => todayEl.click(), 50);
}

function syncCalendarActiveToDate(dateStr) {
    if (!dateStr) return;
    document.querySelectorAll('.calendar-day').forEach((d) => {
        d.classList.toggle('active', d.dataset.dateString === dateStr);
    });
}

function showRestDay(dayName) {
    const dateRow = document.getElementById('session-date-row');
    if (dateRow) dateRow.hidden = true;
    const resetWrap = document.getElementById('reset-session-wrap');
    if (resetWrap) resetWrap.innerHTML = "";
    const waBottom = document.getElementById('whatsapp-bottom');
    if (waBottom) waBottom.style.display = 'none';
    const recoveryUrl = (globalData && globalData.recovery_url && String(globalData.recovery_url).trim())
        ? globalData.recovery_url
        : (DEFAULT_RECOVERY_VIDEO_URL || '');
    const container = document.getElementById('workout-container');
    container.innerHTML = `
        <div class="rest-day-message">
            <span class="rest-icon" aria-hidden="true">🧘‍♀️</span>
            <h2>Jour de récup' — ${escapeHtml(dayName || '')}</h2>
            <p class="rest-lead">Pas de séance aujourd'hui, la récupération fait partie de la progression. Tes résultats se contruisent pendant le repos.</p>
            <p class="rest-tip">Hydrate-toi bien, mange équilibré et dors au mieux. La prochaine séance t'attend ! 💪</p>
            <button type="button" class="btn-pause-respiration" id="btn-pause-respiration" aria-label="Ouvrir la pause respiration (cohérence cardiaque)">🌬️ Pause Respiration</button>
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
    currentSessionDate = dateStr || (session.date || "") || new Date().toISOString().slice(0, 10);
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

    // Bouton discret pour déplacer la séance dans le calendrier
    const moveBtnWrap = document.createElement('div');
    moveBtnWrap.className = 'session-move-wrap';
    moveBtnWrap.innerHTML = `<button type="button" class="btn-move-session" aria-label="Déplacer cette séance à un autre jour">Déplacer la séance</button>`;
    container.appendChild(moveBtnWrap);

    let currentSupersetBlock = null;
    let supersetPos = 0;
    let inWarmupSection = false;
    let inFinishersSection = false;
    let lastWasCircuit = false;

    const sessionIntro = (session.session_intro || session.objectives || session.coach_notes || '').toString().trim();
    if (sessionIntro) {
        container.insertAdjacentHTML('beforeend', `<div class="coach-notes-intro"><div class="coach-notes-text">${escapeHtml(sessionIntro)}</div></div>`);
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
            const isFinishersSection = titleNorm.includes('finisher') || exo.section_style === 'finishers';
            const sectionClass = isFinishersSection ? 'section-title section-title-finishers' : 'section-title';
            if (exo.coach_notes) {
                const notes = String(exo.coach_notes).trim();
                if (notes) {
                    container.insertAdjacentHTML('beforeend', `<div class="coach-notes-intro"><div class="coach-notes-text">${escapeHtml(notes)}</div></div>`);
                }
            }
            container.insertAdjacentHTML('beforeend', `<h2 class="${sectionClass}">${escapeHtml(exo.title)}</h2>`);
            inWarmupSection = isWarmupSection;
            inFinishersSection = isFinishersSection;
            return;
        }

        if (currentSupersetBlock) supersetPos++;

        if (exo.superset_type === "start") {
            currentSupersetBlock = document.createElement('div');
            currentSupersetBlock.className = "superset-block";
            currentSupersetBlock.innerHTML = '<div class="superset-label">Superset</div><div class="superset-row"></div>';
            supersetPos = 1;
        }

        const isCircuit = String(exo.reps || '').toLowerCase().includes('circuit');
        const isFirstCircuit = isCircuit && !lastWasCircuit;
        lastWasCircuit = isCircuit;

        const cardHtml = createExerciseCard(exo, index, currentSessionId, supersetPos > 0 ? supersetPos : null, inWarmupSection, inFinishersSection, isCircuit, isFirstCircuit);
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
    renderSuiviHeaderBar();
    updateSupersetHighlight();
    updateAllExerciseDetails();
    if (document.body.classList.contains('guided-mode')) {
        guidedViewIndex = 0;
        setTimeout(() => {
            guidedViewIndex = getFirstIncompleteIndex();
            updateGuidedMode();
            document.querySelector('.exercise-card.guided-current')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }
}

function createExerciseCard(exo, index, sessionId, supersetRoleNum, isWarmupExercise, isFinishersExercise, isCircuit, isFirstCircuit) {
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

    const chargeArr = Array.isArray(exo.charge)
        ? exo.charge.map(c => String(c).trim())
        : null;
    const chargePerSet = chargeArr && chargeArr.length >= 1;
    const idCharge = `charge-${sessionId}-${index}`;
    const idChargeFirst = chargePerSet ? `charge-${sessionId}-${index}-1` : idCharge;
    const safeExoName = (exo.name || '').replace(/"/g, '&quot;');
    if (warmupSets > 0) {
        checkboxesHtml += `<div class="set-wrapper set-wrapper-warmup-only" data-charge-id="${idChargeFirst}" data-exo-name="${safeExoName}">
            <span class="set-label set-label-warmup-only">Warm-up</span>
        </div>`;
    }
    for (let i = 1; i <= setsCount; i++) {
        checkboxesHtml += `<div class="set-wrapper set-wrapper-work">
            <input type="checkbox" id="set-${index}-${i}" class="set-checkbox" data-card-index="${index}" data-set-num="${i}" data-total-sets="${setsCount}" aria-label="Série ${i} sur ${setsCount}">
            <label for="set-${index}-${i}" class="set-label set-label-work">
                <span class="set-num">${i}</span>
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

    const restSec = (() => {
        const n = parseInt(String(exo.rest).replace(/\D/g, ''), 10);
        return (Number.isFinite(n) && n >= 0) ? n : 60;
    })();
    const supersetRole = supersetRoleNum != null ? String(supersetRoleNum) : '';
    const supersetChip = supersetRole
        ? (() => {
            const letters = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
            const letter = letters[supersetRole] || supersetRole;
            return `<div class="superset-chip">Superset ${letter}</div>`;
        })()
        : '';
    const altData = exo.alternative ? (typeof exo.alternative === 'string' ? { name: exo.alternative } : exo.alternative) : null;
    const altName = altData ? (altData.name || String(exo.alternative)) : '';
    const altIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
    const altBtnHtml = altData ? `<button type="button" class="btn-alternative" data-original-name="${escapeHtml(exo.name || '')}" data-alt-name="${escapeHtml(altName)}" title="Remplacer par : ${escapeHtml(altName)}" aria-label="Remplacer par ${escapeHtml(altName)}">${altIconSvg}</button>` : '';
    const activeTimerHtml = isTimeBased
        ? `<button type="button" class="active-timer-btn" data-target-seconds="${targetSeconds}" aria-label="Lancer le chrono d'effort"><span class="active-timer-progress"></span><span class="active-timer-text">▶ Go</span></button>`
        : '';
    const warmupClass = isWarmupExercise ? ' exercise-warmup' : '';
    const finishersClass = isFinishersExercise ? ' exercise-finishers' : '';
    const warmupSectionAttr = isWarmupExercise ? ' data-warmup-section="1"' : '';
    const circuitAttr = isCircuit ? ' data-circuit="1"' : '';
    const circuitStartAttr = isFirstCircuit ? ' data-circuit-start="1"' : '';
    return `
    <div class="exercise-card open${warmupClass}${finishersClass}" id="card-${index}" data-index="${index}"${warmupSectionAttr}${circuitAttr}${circuitStartAttr}${supersetRole ? ` data-superset-role="${supersetRole}"` : ''}>
        <div class="exercise-header" role="button" tabindex="0" aria-expanded="true" aria-label="Afficher ou masquer les détails de l'exercice">
            <div>
                <div class="exercise-title-row"><span class="exercise-title">${escapeHtml(exo.name)}</span>${altBtnHtml}</div>
                ${supersetChip}
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
                        <span class="timer-progress"></span>
                        <span class="timer-icon">⏱️</span><span class="timer-text">Repos</span>
                        <span class="timer-close" aria-label="Arrêter le chronomètre">×</span>
                    </button>
                    ${activeTimerHtml}
                </div>
                ${checkboxesHtml}
                ${exo.note_coach ? `<div class="coach-note">"${escapeHtml(exo.note_coach)}"</div>` : ''}
                <div class="client-input-zone">
                    <div class="input-row">
                        ${chargePerSet
                            ? `<span class="input-with-btn charge-input-wrap charge-input-per-set">
                                <span class="charge-input-label">Charge par série (kg)</span>
                                <span class="charge-input-row charge-inputs-row">
                                    ${Array.from({ length: setsCount }, (_, i) => {
                                        const setId = i + 1;
                                        const id = `charge-${sessionId}-${index}-${setId}`;
                                        const val = (chargeArr[i] != null ? chargeArr[i] : '').replace(/"/g, '&quot;');
                                        return `<span class="charge-set-wrap"><label for="${id}" class="charge-set-label">S${setId}</label><input type="text" id="${id}" placeholder="—" value="${val}" aria-label="Charge série ${setId} en kg"><span class="charge-suffix">kg</span></span>`;
                                    }).join('')}
                                </span>
                            </span>`
                            : `<span class="input-with-btn charge-input-wrap">
                                <label for="${idCharge}" class="charge-input-label">Charge (kg)</label>
                                <span class="charge-input-row">
                                    <input type="text" id="${idCharge}" placeholder="—" value="${(exo.charge || exo.default_charge || '').toString().replace(/"/g, '&quot;')}" aria-label="Charge en kg">
                                    <span class="charge-suffix">kg</span>
                                </span>
                            </span>`
                        }
                        <input type="hidden" id="${idRpe}" data-rpe-value="">
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
    const inSuperset = !!card.closest('.superset-block');
    const isLastInSuperset = card ? isLastCardOfSuperset(card) : true;
    if (serieNum) serieNum.textContent = currentSetIndex < total ? `${currentSetIndex + 1}/${total}` : `${total}/${total}`;
    if (currentSetIndex >= total && repsEl) repsEl.textContent = isFailure ? "Jusqu'à échec" : '-';
    else if (repsEl && repsData) {
        try {
            const arr = JSON.parse(repsData);
            repsEl.textContent = isFailure ? "Jusqu'à échec" : (arr[currentSetIndex] || arr[arr.length - 1] || '-');
        } catch (_) { repsEl.textContent = '-'; }
    }
    let restDisplay = '60s';
    if (currentSetIndex >= total) {
        if (restEl) {
            if (inSuperset && !isLastInSuperset) {
                // Dans un superset, les exercices intermédiaires n'ajoutent pas de repos "global" : on force 0s.
                restDisplay = '0s';
                restEl.textContent = restDisplay;
            } else {
                // Exercice simple ou dernier exercice du superset : on garde l'affichage neutre.
                restEl.textContent = '-';
            }
        }
    } else if (restData) {
        try {
            const arr = JSON.parse(restData);
            restDisplay = arr[currentSetIndex] || arr[arr.length - 1] || '60s';
            if (restEl) restEl.textContent = restDisplay;
        } catch (_) { if (restEl) restEl.textContent = '60s'; }
    }
    const restSec = (() => {
        const n = parseInt(String(restDisplay).replace(/\D/g, ''), 10);
        return (Number.isFinite(n) && n >= 0) ? n : 60;
    })();
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
                    // À l'intérieur d'un superset, on garde un scroll centré pour bien voir l'exercice courant.
                    currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                // En mode Focus, aligner la carte guidée sur l'exercice courant du superset
                if (document.body.classList.contains('guided-mode')) {
                    const allCards = Array.from(document.querySelectorAll('#workout-container .exercise-card'));
                    const idx = allCards.indexOf(currentCard);
                    if (idx !== -1) {
                        guidedViewIndex = idx;
                        updateGuidedMode();
                    }
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
    if (checkbox.checked) {
        const card = document.getElementById(`card-${cardIndex}`);
        const exoName = card?.querySelector('.exercise-title')?.textContent?.trim() || '';
        const detailsEl = card?.querySelector('.details-dynamic[data-card-index]');
        let repsForSet = '';
        if (detailsEl && detailsEl.dataset.reps) {
            try {
                const arr = JSON.parse(detailsEl.dataset.reps.replace(/&quot;/g, '"'));
                repsForSet = Array.isArray(arr) ? (arr[setNumber - 1] ?? arr[0] ?? '') : String(arr);
            } catch (_) { repsForSet = detailsEl.dataset.reps || ''; }
        }
        const counter = getCounterTypeAndValue(exoName, repsForSet);
        if (counter) incrementCounter(counter.type, counter.value);
    }
    if (document.body.classList.contains('guided-mode')) {
        const card = document.getElementById(`card-${cardIndex}`);
        const inSuperset = !!(card && card.closest('.superset-block'));
        // Dans un superset, on laisse updateSupersetHighlight choisir l'exercice courant (A/B/C...)
        if (!inSuperset) {
            guidedViewIndex = getFirstIncompleteIndex();
            updateGuidedMode();
        }
    }
    const card = document.getElementById(`card-${cardIndex}`);
    if (card) updateExerciseDetails(card);

    if (checkbox.checked && setNumber === totalSets) {
        const card = document.getElementById(`card-${cardIndex}`);
        const supersetBlock = card ? card.closest('.superset-block') : null;
        const inSuperset = !!supersetBlock;
        let collapseDelay = 0;

        if (!inSuperset && card && card.classList.contains('open')) {
            collapseDelay = 300;
            setTimeout(() => { 
                const header = card.querySelector('.exercise-header');
                if (header) toggleCard(header); 
            }, collapseDelay);
        } else if (inSuperset && supersetBlock) {
            const allDone = (() => {
                const cbs = Array.from(supersetBlock.querySelectorAll('.set-checkbox'));
                return cbs.length > 0 && cbs.every(cb => cb.checked);
            })();
            if (allDone) {
                collapseDelay = 500;
                setTimeout(() => {
                    supersetBlock.querySelectorAll('.exercise-card.open .exercise-header').forEach(h => toggleCard(h));
                }, collapseDelay);
            }
        }
        const exoName = card?.querySelector('.exercise-title')?.textContent?.trim() || 'Exercice';
        const doScroll = () => {
            if (!card) return;
            const shouldScroll = isLastCardOfSuperset(card);
            if (!shouldScroll) return;
            const container = document.getElementById('workout-container');
            const cards = container ? Array.from(container.querySelectorAll('.exercise-card')) : [];
            const idx = cards.findIndex(c => c.id === `card-${cardIndex}`);
            const nextCard = idx >= 0 && idx < cards.length - 1 ? cards[idx + 1] : null;
            if (document.body.classList.contains('guided-mode')) {
                if (nextCard) {
                    guidedViewIndex = idx + 1;
                    updateGuidedMode();
                }
                return;
            }
            if (nextCard) {
                const supersetBlock = nextCard.closest('.superset-block');
                const scrollTarget = supersetBlock || nextCard;
                const blockMode = supersetBlock ? 'start' : 'center';
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: blockMode });
            }
        };
        const isWarmupSection = card?.dataset.warmupSection === '1';
        const scrollDelay = collapseDelay + 550; // on laisse le temps au repli de finir avant de scroller
        const showRpe = !isWarmupSection && isLastCardOfSuperset(card);
        if (showRpe) {
            setTimeout(() => {
                showRpeModal(cardIndex, currentSessionId, exoName, doScroll);
            }, scrollDelay);
        } else {
            setTimeout(doScroll, scrollDelay);
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

function getMilestonesShown() {
    try { return JSON.parse(localStorage.getItem(KEY_MILESTONES) || '{}'); }
    catch { return {}; }
}
function setMilestoneShown(key) {
    const o = getMilestonesShown();
    o[key] = true;
    localStorage.setItem(KEY_MILESTONES, JSON.stringify(o));
}

/** Volume total (kg) pour les exercices dont le nom matche "hip thrust". */
function getHipThrustVolume(byExo) {
    let sum = 0;
    Object.entries(byExo || {}).forEach(([name, data]) => {
        if (/hip\s*[- ]?thrust/i.test(name)) sum += (data.volume || 0);
    });
    return sum;
}

/** Paliers : threshold croissant par catégorie, on affiche chaque palier franchi (non encore montré). */
const MILESTONE_CONFIG = [
    { key: 'burpees100', type: 'counter', counter: 'burpees', threshold: 100, label: '100 burpees', emoji: '💪' },
    { key: 'burpees250', type: 'counter', counter: 'burpees', threshold: 250, label: '250 burpees', emoji: '🔥' },
    { key: 'burpees1000', type: 'counter', counter: 'burpees', threshold: 1000, label: '1000 burpees', emoji: '🔥' },
    { key: 'squats250', type: 'counter', counter: 'squats', threshold: 250, label: '250 squats', emoji: '🦵' },
    { key: 'squats500', type: 'counter', counter: 'squats', threshold: 500, label: '500 squats', emoji: '🦵' },
    { key: 'squats1000', type: 'counter', counter: 'squats', threshold: 1000, label: '1000 squats', emoji: '🦵' },
    { key: 'squats2500', type: 'counter', counter: 'squats', threshold: 2500, label: '2500 squats', emoji: '🦵' },
    { key: 'pompes50', type: 'counter', counter: 'pompes', threshold: 50, label: '50 pompes', emoji: '💪' },
    { key: 'pompes100', type: 'counter', counter: 'pompes', threshold: 100, label: '100 pompes', emoji: '💪' },
    { key: 'pompes200', type: 'counter', counter: 'pompes', threshold: 200, label: '200 pompes', emoji: '💪' },
    { key: 'pompes500', type: 'counter', counter: 'pompes', threshold: 500, label: '500 pompes', emoji: '💪' },
    { key: 'fentes250', type: 'counter', counter: 'fentes', threshold: 250, label: '250 fentes', emoji: '🦵' },
    { key: 'fentes500', type: 'counter', counter: 'fentes', threshold: 500, label: '500 fentes', emoji: '🦵' },
    { key: 'fentes1000', type: 'counter', counter: 'fentes', threshold: 1000, label: '1000 fentes', emoji: '🦵' },
    { key: 'fentes2500', type: 'counter', counter: 'fentes', threshold: 2500, label: '2500 fentes', emoji: '🦵' },
    { key: 'hipthrust1000', type: 'volume_hipthrust', threshold: 1000, label: '1000 kg en hip-thrust', emoji: '🏋️' },
    { key: 'hipthrust2500', type: 'volume_hipthrust', threshold: 2500, label: '2500 kg en hip-thrust', emoji: '🏋️' },
    { key: 'hipthrust5000', type: 'volume_hipthrust', threshold: 5000, label: '5000 kg en hip-thrust', emoji: '🏋️' },
    { key: 'hipthrust10000', type: 'volume_hipthrust', threshold: 10000, label: '10 000 kg en hip-thrust', emoji: '🏋️' },
    { key: 'volume5000', type: 'volume_total', threshold: 5000, label: '5000 kg soulevé au total', emoji: '' },
    { key: 'volume10000', type: 'volume_total', threshold: 10000, label: '10 000 kg soulevé au total', emoji: '' },
    { key: 'volume25000', type: 'volume_total', threshold: 25000, label: '25 000 kg soulevé au total', emoji: '' },
    { key: 'volume50000', type: 'volume_total', threshold: 50000, label: '50 000 kg soulevé au total', emoji: '' },
    { key: 'volume100000', type: 'volume_total', threshold: 100000, label: '100 000 kg soulevé au total', emoji: '' },
    { key: 'training5h', type: 'training_seconds', threshold: 5 * 3600, label: '5 h d\'entraînement', emoji: '⏱️' },
    { key: 'training15h', type: 'training_seconds', threshold: 15 * 3600, label: '15 h d\'entraînement', emoji: '⏱️' },
    { key: 'training35h', type: 'training_seconds', threshold: 35 * 3600, label: '35 h d\'entraînement', emoji: '⏱️' },
    { key: 'training70h', type: 'training_seconds', threshold: 70 * 3600, label: '70 h d\'entraînement', emoji: '⏱️' },
    { key: 'training100h', type: 'training_seconds', threshold: 100 * 3600, label: '100 h d\'entraînement', emoji: '⏱️' }
];

function showMilestoneModalIfNeeded(thenOpenCompletion) {
    const counters = getCounters();
    const { byExo, totalVolume } = getProgression1RMAndVolume();
    const hipThrustVolume = getHipThrustVolume(byExo);
    const shown = getMilestonesShown();
    const achieved = [];
    const trainingSeconds = getTrainingSeconds();
    MILESTONE_CONFIG.forEach(({ key, type, counter, threshold, label, emoji }) => {
        if (shown[key]) return;
        let value = 0;
        if (type === 'counter') value = counters[counter] || 0;
        else if (type === 'volume_total') value = totalVolume || 0;
        else if (type === 'volume_hipthrust') value = hipThrustVolume || 0;
        else if (type === 'training_seconds') value = trainingSeconds || 0;
        if (value >= threshold) {
            achieved.push({ key, label: label + ' !', emoji });
            setMilestoneShown(key);
        }
    });
    if (achieved.length === 0) {
        thenOpenCompletion();
        return;
    }
    const overlay = document.getElementById('milestone-overlay');
    const body = document.getElementById('milestone-modal-body');
    if (!overlay || !body) {
        thenOpenCompletion();
        return;
    }
    body.innerHTML = achieved.map(a => `<p class="milestone-item">${escapeHtml(a.emoji)} ${escapeHtml(a.label)}</p>`).join('') +
        '<button type="button" class="btn-milestone-continue" id="btn-milestone-continue">Continuer</button>';
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const onClose = () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.getElementById('btn-milestone-continue')?.removeEventListener('click', onClose);
        thenOpenCompletion();
    };
    document.getElementById('btn-milestone-continue')?.addEventListener('click', onClose);
}

function openCompletionOverlay() {
    sessionEndTime = Date.now();
    if (sessionStartTime != null && sessionEndTime != null) {
        addTrainingSeconds(Math.round((sessionEndTime - sessionStartTime) / 1000));
    }
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

function updateProgress(shouldOpenModal = false) {
    const total = document.querySelectorAll('.set-checkbox').length;
    const checked = document.querySelectorAll('.set-checkbox:checked').length;
    const percent = (total === 0) ? 0 : (checked / total) * 100;
    
    document.getElementById('progress-bar').style.width = percent + "%";

    // Micro encouragement visuel unique en fin de séance, sans interaction
    if (percent >= 80 && percent < 100 && !encouragementShown75) {
        encouragementShown75 = true;
        showEncouragementBanner(getRandomEncouragementMessage());
    }

    if (percent === 100 && shouldOpenModal) {
        saveChargeHistory();
        showMilestoneModalIfNeeded(openCompletionOverlay);
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

function getTrainingSeconds() {
    const v = localStorage.getItem(KEY_TRAINING_SECONDS);
    const n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? 0 : n;
}
function addTrainingSeconds(sec) {
    if (sec <= 0) return;
    const current = getTrainingSeconds();
    localStorage.setItem(KEY_TRAINING_SECONDS, String(current + Math.round(sec)));
}

function getMensurations() {
    try { return JSON.parse(localStorage.getItem(KEY_MENSURATIONS) || '[]'); }
    catch { return []; }
}
function setMensurations(arr) {
    localStorage.setItem(KEY_MENSURATIONS, JSON.stringify(arr || []));
}
function getPoids() {
    try { return JSON.parse(localStorage.getItem(KEY_POIDS) || '[]'); }
    catch { return []; }
}
function setPoids(arr) {
    localStorage.setItem(KEY_POIDS, JSON.stringify(arr || []));
}
function getVetementTest() {
    try {
        const v = localStorage.getItem(KEY_VETEMENT_TEST);
        if (!v) return { name: '', entries: [] };
        const o = JSON.parse(v);
        return { name: o.name || '', entries: o.entries || [] };
    } catch { return { name: '', entries: [] }; }
}
function setVetementTest(obj) {
    localStorage.setItem(KEY_VETEMENT_TEST, JSON.stringify(obj || { name: '', entries: [] }));
}
function getSuiviHeader() {
    try {
        const v = localStorage.getItem(KEY_SUIVI_HEADER);
        if (!v) return { show_poids: false, show_taille: false, show_hanches: false, show_poitrine: false, show_cuisses: false, show_bras: false, show_vetement: false, objectif_poids: null, objectif_taille: null, objectif_hanches: null, objectif_poitrine: null, objectif_cuisses: null, objectif_bras: null };
        const o = JSON.parse(v);
        return { show_poids: !!o.show_poids, show_taille: !!o.show_taille, show_hanches: !!o.show_hanches, show_poitrine: !!o.show_poitrine, show_cuisses: !!o.show_cuisses, show_bras: !!o.show_bras, show_vetement: !!o.show_vetement, objectif_poids: o.objectif_poids ?? null, objectif_taille: o.objectif_taille ?? null, objectif_hanches: o.objectif_hanches ?? null, objectif_poitrine: o.objectif_poitrine ?? null, objectif_cuisses: o.objectif_cuisses ?? null, objectif_bras: o.objectif_bras ?? null };
    } catch { return { show_poids: false, show_taille: false, show_hanches: false, show_poitrine: false, show_cuisses: false, show_bras: false, show_vetement: false, objectif_poids: null, objectif_taille: null, objectif_hanches: null, objectif_poitrine: null, objectif_cuisses: null, objectif_bras: null }; }
}
function setSuiviHeader(obj) {
    localStorage.setItem(KEY_SUIVI_HEADER, JSON.stringify(obj || {}));
}
/** Vérifie qu'une valeur de mensuration (cm) ou de poids (kg) est dans une plage raisonnable. */
function isValidSuiviValue(value, type) {
    if (value == null || isNaN(value)) return false;
    if (type === 'poids') return value >= 20 && value <= 300;
    if (type === 'tour') return value >= 15 && value <= 250;
    return true;
}

/** Retourne "Aujourd'hui", "Hier", "Il y a X jours" ou "Dans X jours" pour une date YYYY-MM-DD. */
function formatDateRelative(dateStr) {
    if (!dateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T12:00:00');
    d.setHours(0, 0, 0, 0);
    const diffMs = today - d;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays > 1) return `Il y a ${diffDays} jours`;
    if (diffDays === -1) return 'Demain';
    if (diffDays < -1) return `Dans ${Math.abs(diffDays)} jours`;
    return dateStr;
}

const VETEMENT_FEELING_LABELS = {
    trop_petit: 'Trop petit',
    serre_mais_va: 'Je me sens serré mais ça va',
    pile: 'Pile à ma taille',
    peu_large: 'Un peu large',
    trop_grand: 'Trop grand'
};

/** Compteurs (burpees, squats, gainage_seconds, pompes, fentes). */
function getCounters() {
    try {
        return JSON.parse(localStorage.getItem(KEY_COUNTERS) || '{}');
    } catch { return {}; }
}

/** Couleur commune pour sliders (0 → 1) : vert → jaune → orange → rouge. */
function sliderColorForRatio(ratio) {
    const x = Math.max(0, Math.min(1, ratio || 0));
    const stops = [
        { r: 34, g: 197, b: 94 },   // #22c55e vert
        { r: 234, g: 179, b: 8 },   // #eab308 jaune
        { r: 249, g: 115, b: 22 },  // #f97316 orange
        { r: 239, g: 68, b: 68 }    // #ef4444 rouge
    ];
    const seg = x * 3; // 0–1, 1–2, 2–3
    const i = Math.floor(seg);
    const t = seg - i;
    const a = stops[i] || stops[0];
    const b = stops[i + 1] || stops[stops.length - 1];
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bch = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r}, ${g}, ${bch})`;
}

function initScoreSliderColors() {
    document.querySelectorAll('.score-slider').forEach(slider => {
        const min = parseInt(slider.min, 10);
        const max = parseInt(slider.max, 10);
        const val = parseInt(slider.value, 10);
        const lo = isNaN(min) ? 0 : min;
        const hi = isNaN(max) || max === lo ? lo + 10 : max;
        const v = isNaN(val) ? (lo + hi) / 2 : val;
        const ratio = (v - lo) / (hi - lo || 1);
        const color = sliderColorForRatio(ratio);
        slider.style.setProperty('--slider-thumb-color', color);
    });
}
function setCounters(obj) {
    localStorage.setItem(KEY_COUNTERS, JSON.stringify(obj));
}
function incrementCounter(type, value) {
    const c = getCounters();
    c[type] = (c[type] || 0) + value;
    setCounters(c);
}

/**
 * Détecte le type de compteur et la valeur à partir du nom d'exo et des reps.
 * Ce qui compte : Squats = tout exo dont le nom contient "squat" (squat barre, goblet squat, etc.) ;
 * Fentes = "fente" ; Pompes = "pompe" ; Burpees = "burpee" (reps ou chiffre dans le nom à l'échauffement) ;
 * Gainage = "gainage", "planche", "plank" ou "hold" (en secondes) ; Escalier = "escalier" (en secondes).
 */
function getCounterTypeAndValue(exoName, repsForSet) {
    const name = (exoName || '').toLowerCase();
    const repsStr = String(repsForSet ?? '').trim();
    const matchNum = repsStr.match(/(\d+)/);
    let num = matchNum ? parseInt(matchNum[1], 10) : 1;
    const isGainageLike = /gainage|planche|plank|hold/i.test(name);
    const matchSec = repsStr.match(/(\d+)\s*(s|sec|secondes?|min|mn)?/i);
    const seconds = matchSec
        ? (matchSec[2] && matchSec[2].toLowerCase().startsWith('min') ? parseInt(matchSec[1], 10) * 60 : parseInt(matchSec[1], 10))
        : (isGainageLike ? num : 0);
    if (/burpee/i.test(name)) {
        // Cas particulier burpees :
        // - si aucun chiffre explicite dans les reps (échauffement "10 burpees")
        //   on va chercher le nombre dans le NOM de l'exercice.
        if (!matchNum || num <= 0) {
            const nameMatch = (exoName || '').match(/(\d+)\s*burpee/i);
            num = nameMatch ? parseInt(nameMatch[1], 10) : 1;
        }
        return { type: 'burpees', value: num, isTime: false };
    }
    if (/squat/i.test(name)) return { type: 'squats', value: num, isTime: false };
    if (isGainageLike) return { type: 'gainage_seconds', value: seconds || num, isTime: true };
    if (/escalier/i.test(name)) {
        const escSec = matchSec ? (matchSec[2] && matchSec[2].toLowerCase().startsWith('min') ? parseInt(matchSec[1], 10) * 60 : parseInt(matchSec[1], 10)) : num;
        return { type: 'escalier_seconds', value: escSec || num, isTime: true };
    }
    if (/pompe/i.test(name)) return { type: 'pompes', value: num, isTime: false };
    if (/fente/i.test(name)) return { type: 'fentes', value: num, isTime: false };
    return null;
}

/** Volume d'une entrée (kg) = charge × reps × sets. Anciennes entrées sans reps/sets : 1. */
function entryVolume(h) {
    const reps = h.reps != null ? h.reps : 1;
    const sets = h.sets != null ? h.sets : 1;
    return (h.charge || 0) * Math.max(1, reps) * Math.max(1, sets);
}

/** Agrège historique : meilleur 1RM et volume par exo, volume total. Une entrée par (sessionId, date, exoIdx) pour le volume. */
function getProgression1RMAndVolume() {
    const history = getChargeHistory();
    const seen = new Set();
    const byExo = {};
    let totalVolume = 0;
    history.forEach(h => {
        const key = `${h.sessionId}|${h.date}|${h.exoIdx}`;
        const vol = entryVolume(h);
        const reps = h.reps != null ? h.reps : 1;
        const rm = epley1RM(h.charge, reps);
        const name = h.exoName || `Exo ${h.exoIdx}`;
        if (!byExo[name]) byExo[name] = { best1RM: 0, volume: 0 };
        if (is1RMTrackedExercise(name) && rm > byExo[name].best1RM) byExo[name].best1RM = rm;
        if (!seen.has(key)) {
            seen.add(key);
            byExo[name].volume += vol;
            totalVolume += vol;
        }
    });
    return { byExo, totalVolume };
}

/** Badges volume (seuils en kg). */
const VOLUME_BADGE_THRESHOLDS = [1000, 5000, 10000, 50000, 100000];

function getProgressionBadges() {
    const completed = getCompletedSessions();
    const totalSessions = completed.length;
    const sessions = globalData && globalData.sessions ? globalData.sessions : [];
    const st = sessions.length ? getStats(sessions) : { streakWeeks: 0 };
    const { byExo, totalVolume } = getProgression1RMAndVolume();
    const volumeBadges = VOLUME_BADGE_THRESHOLDS.filter(t => totalVolume >= t);
    const exoVolumes = Object.entries(byExo).map(([name, data]) => ({ name, volume: data.volume }));
    const exoBadges = exoVolumes.filter(e => e.volume >= 1000).map(e => ({ exo: e.name, volume: e.volume }));
    return { totalSessions, streakWeeks: st.streakWeeks, totalVolume, volumeBadges, exoBadges };
}

function parseRepsFromExo(exo) {
    const r = exo.reps;
    if (r == null) return 1;
    const s = String(r).trim();
    const m = s.match(/\d+/);
    return m ? Math.max(1, parseInt(m[0], 10)) : 1;
}

function parseSetsFromExo(exo) {
    const s = exo.sets;
    if (s == null) return 1;
    const n = parseInt(String(s).replace(/\D/g, ''), 10);
    return isNaN(n) || n < 1 ? 1 : n;
}

/** Noms d'exercices pour lesquels on affiche le 1RM théorique (normalisés : minuscules, sans accents). */
function is1RMTrackedExercise(exoName) {
    const n = (exoName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (/squat[s]?\s*(a la barre|à la barre)/.test(n) || /squats?\s*barre/.test(n))
        || /hip\s*[- ]?thrust/.test(n)
        || /developpe\s+inclin[eé]\s+haltere/.test(n) || /d[eé]velopp[eé]\s+inclin/.test(n)
        || /tirage\s+vertical.*poitrine/.test(n) || /tirage vertical poitrine/.test(n)
        || /goblet\s+squat/.test(n);
}

/** 1RM théorique (formule d'Epley) : 1RM = Poids × (1 + 0,0333 × reps) */
function epley1RM(charge, reps) {
    if (charge <= 0) return 0;
    const r = Math.max(1, reps || 1);
    return Math.round(charge * (1 + 0.0333 * r) * 10) / 10;
}

function saveChargeHistory() {
    const history = getChargeHistory();
    const session = globalData && globalData.sessions ? globalData.sessions.find(s => (s.id === currentSessionId) || (`session_${globalData.sessions.indexOf(s)}` === currentSessionId)) : null;
    if (!session || !session.exercises) return;
    const dateStr = currentSessionDate || new Date().toISOString().slice(0, 10);
    const toAdd = [];
    session.exercises.forEach((exo, idx) => {
        if (exo.type === 'section') return;
        const idCharge = `charge-${currentSessionId}-${idx}`;
        let val = '';
        const chargeEl = document.getElementById(idCharge);
        if (chargeEl) {
            val = String(chargeEl.value || '').trim();
        } else {
            const setsCount = parseInt(exo.sets) || 3;
            const lastSetEl = document.getElementById(`charge-${currentSessionId}-${idx}-${setsCount}`);
            if (lastSetEl) val = String(lastSetEl.value || '').trim();
        }
        const numVal = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (val && !isNaN(numVal)) {
            const reps = parseRepsFromExo(exo);
            const sets = parseSetsFromExo(exo);
            toAdd.push({ sessionId: currentSessionId, exoIdx: idx, exoName: exo.name, charge: numVal, reps: reps || 1, sets: sets || 1, date: dateStr });
        }
    });
    const keysToReplace = new Set(toAdd.map(e => `${e.sessionId}|${e.date}|${e.exoIdx}`));
    const kept = history.filter(h => !keysToReplace.has(`${h.sessionId}|${h.date}|${h.exoIdx}`));
    const next = [...kept, ...toAdd];
    while (next.length > 200) next.shift();
    localStorage.setItem(KEY_CHARGE_HISTORY, JSON.stringify(next));
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
        const loud = getSettingLoudBeep();
        osc.frequency.value = loud ? 950 : 800;
        osc.type = 'sine';
        // Bip normal vs bip plus fort et légèrement plus long
        const startGain = loud ? 0.9 : 0.6;
        const duration = loud ? 0.45 : 0.35;
        gain.gain.setValueAtTime(startGain, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
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

// Bannière discrète qui descend du haut de l'écran puis disparaît seule
function showEncouragementBanner(message) {
    const el = document.getElementById('encouragement-banner');
    if (!el) return;
    el.textContent = message || '';

    // Annuler un éventuel timer précédent
    if (el.dataset.hideTimeoutId) {
        clearTimeout(parseInt(el.dataset.hideTimeoutId, 10));
    }

    el.classList.add('show');
    const timeoutId = setTimeout(() => {
        el.classList.remove('show');
        el.dataset.hideTimeoutId = '';
    }, 3500);
    el.dataset.hideTimeoutId = String(timeoutId);
}

function startTimer(btn, seconds) {
    if (btn.classList.contains('active') && !btn.dataset.timerPaused) return;
    let timeLeft = parseInt(btn.dataset.timerPaused, 10) || seconds;
    // Mémoriser la durée totale pour pouvoir animer la barre de repos
    if (!btn.dataset.totalSeconds) {
        btn.dataset.totalSeconds = String(seconds);
    }
    const totalSeconds = parseInt(btn.dataset.totalSeconds, 10) || seconds;
    btn.removeAttribute('data-timer-paused');
    btn.classList.add('active');
    btn.classList.add('timer-floating');
    const timerText = btn.querySelector('.timer-text');
    timerText.textContent = `Repos : ${timeLeft}s`;
    const progressEl = btn.querySelector('.timer-progress');
    if (progressEl && totalSeconds > 0) {
        const ratio = Math.max(0, Math.min(1, timeLeft / totalSeconds));
        progressEl.style.transform = `scaleX(${ratio})`;
    }
    const interval = setInterval(() => {
        timeLeft--;
        timerText.textContent = `Repos : ${timeLeft}s`;
        if (progressEl && totalSeconds > 0) {
            const ratio = Math.max(0, Math.min(1, timeLeft / totalSeconds));
            progressEl.style.transform = `scaleX(${ratio})`;
        }
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

function toggleTimerPause(btn) {
    if (!btn.classList.contains('active')) return;
    const intervalId = btn.dataset.timerInterval;
    if (intervalId) clearInterval(parseInt(intervalId, 10));
    btn.dataset.timerInterval = '';
    const timerText = btn.querySelector('.timer-text');
    const match = timerText && timerText.textContent.match(/(\d+)s/);
    const timeLeft = match ? parseInt(match[1], 10) : 0;
    if (timeLeft <= 0) return;
    btn.dataset.timerPaused = timeLeft;
    timerText.textContent = `Repos : ${timeLeft}s (pause)`;
    /* Garder le timer flottant en pause pour qu’un clic = pause, croix = supprimer */
}

function stopTimer(btn) {
    const intervalId = btn.dataset.timerInterval;
    if (intervalId) clearInterval(parseInt(intervalId, 10));
    btn.dataset.timerInterval = '';
    btn.removeAttribute('data-timer-paused');
    btn.classList.remove('active');
    btn.classList.remove('timer-floating');
    const timerText = btn.querySelector('.timer-text');
    if (timerText) timerText.textContent = "Lancer le repos";
    const progressEl = btn.querySelector('.timer-progress');
    if (progressEl) progressEl.style.transform = 'scaleX(0)';
}

function startActiveTimer(btn) {
    if (btn.classList.contains('active') && !btn.dataset.activeTimerPaused) return;
    const targetSec = parseInt(btn.dataset.targetSeconds, 10) || 45;
    let elapsed = parseInt(btn.dataset.activeTimerPaused, 10) || 0;
    btn.removeAttribute('data-active-timer-paused');
    btn.classList.add('active');
    const textEl = btn.querySelector('.active-timer-text');
    const progressEl = btn.querySelector('.active-timer-progress');
    const updateVisual = (remaining) => {
        const ratio = Math.max(0, Math.min(1, remaining / targetSec));
        if (progressEl) {
            progressEl.style.transform = `scaleX(${ratio})`;
            // La barre interne passe de bleu foncé à bleu clair en se vidant,
            // mais le fond du bouton (couleur de base) reste inchangé.
            // Barre foncée quand pleine, de plus en plus claire en se vidant
            const dark = { r: 39, g: 71, b: 177 };   //rgb(39, 71, 177)
            const light = { r: 39, g: 71, b: 177 }; // #60a5fa
            const t = 1 - ratio; // 0 = pleine (foncé), 1 = presque vide (clair)
            const r = Math.round(dark.r + (light.r - dark.r) * t);
            const g = Math.round(dark.g + (light.g - dark.g) * t);
            const b = Math.round(dark.b + (light.b - dark.b) * t);
            progressEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        }
    };
    const interval = setInterval(() => {
        elapsed++;
        const remaining = targetSec - elapsed;
        if (textEl) textEl.textContent = remaining > 0 ? `${remaining}s` : 'Terminé !';
        updateVisual(Math.max(remaining, 0));
        if (remaining > 0 && remaining <= 3) playBeep();
        if (elapsed >= targetSec) {
            clearInterval(interval);
            btn.classList.remove('active');
            btn.dataset.activeTimerInterval = '';
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
    btn.dataset.activeTimerInterval = interval;
    const initialRemaining = targetSec - elapsed;
    if (textEl) textEl.textContent = initialRemaining > 0 ? `${initialRemaining}s` : `${targetSec}s`;
    updateVisual(Math.max(initialRemaining, 0));
}

function toggleActiveTimerPause(btn) {
    if (!btn.classList.contains('active')) return;
    const intervalId = btn.dataset.activeTimerInterval;
    if (intervalId) clearInterval(parseInt(intervalId, 10));
    btn.dataset.activeTimerInterval = '';
    const targetSec = parseInt(btn.dataset.targetSeconds, 10) || 45;
    const textEl = btn.querySelector('.active-timer-text');
    const match = textEl && textEl.textContent.match(/(\d+)s/);
    const remaining = match ? parseInt(match[1], 10) : 0;
    if (remaining <= 0) return;
    btn.dataset.activeTimerPaused = targetSec - remaining;
    if (textEl) textEl.textContent = `${remaining}s (pause)`;
}

function stopActiveTimer(btn) {
    const id = btn.dataset.activeTimerInterval;
    if (id) clearInterval(parseInt(id, 10));
    btn.classList.remove('active');
    const textEl = btn.querySelector('.active-timer-text');
    if (textEl) textEl.textContent = '▶ Go';
    const progressEl = btn.querySelector('.active-timer-progress');
    if (progressEl) progressEl.style.transform = 'scaleX(0)';
}

function showWarmupGenerator(chargeId, exoName) {
    const input = document.getElementById(chargeId);
    const target = parseInt(String(input?.value || '').replace(/\D/g, ''), 10);
    if (!target || target < 20) {
        showToast('Saisis ta charge de travail (kg) pour générer l\'échauffement.');
        return;
    }
    const s1 = Math.round(target * 0.4 / 2.5) * 2.5 || 20;
    const s2 = Math.round(target * 0.6 / 2.5) * 2.5;
    const s3 = Math.round(target * 0.8 / 2.5) * 2.5;
    const fmt = (x) => (x % 1 === 0 ? String(x) : x.toFixed(1));
    const lines = [
        `Sans pause :`,
        `${fmt(s1)}kg (40%) x 8 reps`,
        `${fmt(s2)}kg (60%) x 5 reps`,
        `${fmt(s3)}kg (80%) x 3 reps`,
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
    el.querySelector('h3').textContent = `Échauffement ${exoName}`;
    el.querySelector('.warmup-list').innerHTML = lines.map((l, i) => `<li class="${i === 0 ? 'warmup-intro' : ''}">${escapeHtml(l)}</li>`).join('');
    el.classList.add('active');
}

function isLastCardOfSuperset(card) {
    const block = card.closest('.superset-block');
    if (!block) return true;
    const cards = Array.from(block.querySelectorAll('.exercise-card[data-superset-role]'))
        .sort((a, b) => parseInt(a.dataset.supersetRole, 10) - parseInt(b.dataset.supersetRole, 10));
    const lastCard = cards[cards.length - 1];
    return lastCard && card.id === lastCard.id;
}

function showRpeModal(cardIndex, sessionId, exoName, onConfirm) {
    const idRpe = `rpe-${sessionId}-${cardIndex}`;
    let el = document.getElementById('rpe-modal-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rpe-modal-overlay';
        el.className = 'rpe-modal-overlay';
        el.innerHTML = `
            <div class="rpe-modal" role="dialog" aria-labelledby="rpe-modal-title" aria-modal="true">
                <button type="button" class="rpe-modal-close" aria-label="Fermer">×</button>
                <h3 id="rpe-modal-title">Comment c’était ?</h3>
                <div class="rpe-modal-exo-wrap"><span class="rpe-modal-exo"></span></div>
                <div class="rpe-modal-slider-wrap">
                    <label for="rpe-modal-slider">Effort ressenti (1 = facile, 10 = max)</label>
                    <input type="range" id="rpe-modal-slider" class="rpe-modal-slider" min="1" max="10" value="7">
                    <span class="rpe-modal-value">7</span>
                </div>
                <button type="button" class="rpe-modal-confirm">Valider</button>
            </div>`;
        document.body.appendChild(el);
        const closeRpeModal = () => {
            el.classList.remove('active');
            if (el._onConfirm) { el._onConfirm(); el._onConfirm = null; }
        };
        el.querySelector('.rpe-modal-close').onclick = closeRpeModal;
        el.onclick = (e) => { if (e.target === el) closeRpeModal(); };
        el.querySelector('.rpe-modal-slider').addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10) || 1;
            el.querySelector('.rpe-modal-value').textContent = String(val);
            // mettre à jour la couleur du thumb en fonction de la position (vert → jaune → orange → rouge)
            const min = parseInt(e.target.min, 10) || 1;
            const max = parseInt(e.target.max, 10) || 10;
            const ratio = (val - min) / (max - min || 1);
            const color = sliderColorForRatio(ratio);
            e.target.style.setProperty('--slider-thumb-color', color);
        });
        el.querySelector('.rpe-modal-confirm').onclick = () => {
            const id = el._currentRpeId;
            if (id) {
                const val = el.querySelector('.rpe-modal-slider').value;
                const input = document.getElementById(id);
                if (input) input.value = val;
                if (input && input.dataset) input.dataset.rpeValue = val;
                saveData();
            }
            closeRpeModal();
        };
    }
    el._currentRpeId = idRpe;
    const existingVal = document.getElementById(idRpe)?.value || '';
    const slider = el.querySelector('.rpe-modal-slider');
    const valueSpan = el.querySelector('.rpe-modal-value');
    // Récupérer le RPE cible du coach pour cet exercice (si défini)
    let targetRpe = null;
    const sessions = globalData && globalData.sessions ? globalData.sessions : [];
    const session = sessions.find(s => (s.id || '') === sessionId);
    if (session && Array.isArray(session.exercises)) {
        const exo = session.exercises[cardIndex];
        if (exo && exo.rpe_target != null) {
            const n = parseInt(exo.rpe_target, 10);
            if (!isNaN(n) && n >= 1 && n <= 10) targetRpe = String(n);
        }
    }
    const initial = existingVal || targetRpe || '7';
    if (slider) {
        slider.value = initial;
        slider.dispatchEvent(new Event('input'));
    }
    if (valueSpan) valueSpan.textContent = slider?.value || initial;
    el.querySelector('.rpe-modal-exo').textContent = exoName || 'Exercice';
    el._onConfirm = onConfirm;
    el.classList.add('active');
    slider?.focus();
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
        <div class="rpe-scale-labels"><span>1-2</span><span>3-4</span><span>5-6</span><span>7-8</span><span>9-10</span></div>
        <div class="rpe-scale-items rpe-scale-items-new">
            <div class="rpe-scale-row"><span class="rpe-range">1/2</span><span class="rpe-desc">Très facile</span></div>
            <div class="rpe-scale-row"><span class="rpe-range">3/4</span><span class="rpe-desc">Facile</span></div>
            <div class="rpe-scale-row"><span class="rpe-range">5/6</span><span class="rpe-desc">Moyen</span></div>
            <div class="rpe-scale-row"><span class="rpe-range">7/8</span><span class="rpe-desc">Difficile</span></div>
            <div class="rpe-scale-row"><span class="rpe-range">9/10</span><span class="rpe-desc">Très difficile</span></div>
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
        let chargeVal = document.getElementById(idCharge)?.value?.trim() || null;
        if (!chargeVal) {
            const chargeParts = [];
            for (let s = 1; s <= setsTotal; s++) {
                const v = document.getElementById(`charge-${currentSessionId}-${originalIndex}-${s}`)?.value?.trim();
                if (v) chargeParts.push(v);
            }
            if (chargeParts.length) chargeVal = chargeParts.join(' / ');
        }
        exercises.push({
            name: title,
            setsTotal,
            setsCompleted,
            charge: chargeVal,
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
    const dateFormatted = report.date ? new Date(report.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    let msg = `✨ *Rapport - ${report.sessionName}* ✨\n`;
    msg += `📅 ${dateFormatted}`;
    if (report.durationMinutes != null) msg += `  |  ⏱️ ${report.durationMinutes} min`;
    msg += `\n\n`;

    report.exercises.forEach((ex) => {
        const chargeStr = ex.charge ? (ex.charge.replace(/\s*kg\s*/gi, '').trim() + ' kg') : '';
        const rpeStr = ex.rpe ? ` (RPE ${ex.rpe})` : '';
        const noteStr = ex.note ? `  — ${ex.note}` : '';
        msg += `✅ *${ex.name}* : ${ex.setsCompleted}/${ex.setsTotal}`;
        if (chargeStr) msg += ` × ${chargeStr}`;
        msg += rpeStr + noteStr + '\n';
    });

    const b = report.bilan;
    if (b.muscle != null && b.muscle !== '' || b.cardio != null && b.cardio !== '' || b.fatigue != null && b.fatigue !== '' || b.sommeil != null && b.sommeil !== '') {
        msg += `\n📊 *BILAN :*`;
        if (b.muscle != null && b.muscle !== '') msg += ` 💪 ${b.muscle}/10`;
        if (b.cardio != null && b.cardio !== '') msg += ` 🫀 ${b.cardio}/10`;
        if (b.fatigue != null && b.fatigue !== '') msg += ` 😫 ${b.fatigue}/10`;
        if (b.sommeil != null && b.sommeil !== '') msg += ` 💤 ${b.sommeil}/10`;
        msg += '\n';
        if (b.muscleCom || b.cardioCom || b.fatigueCom || b.sommeilCom) {
            if (b.muscleCom) msg += `   _Muscle : ${b.muscleCom}_\n`;
            if (b.cardioCom) msg += `   _Cardio : ${b.cardioCom}_\n`;
            if (b.fatigueCom) msg += `   _Fatigue : ${b.fatigueCom}_\n`;
            if (b.sommeilCom) msg += `   _Sommeil : ${b.sommeilCom}_\n`;
        }
    }
    if (report.coachNote) {
        setCoachNote(report.coachNote);
        msg += `\n💬 *Message pour toi :* ${report.coachNote}\n`;
    }

    msg += `\n_Envoyé depuis mon App Coaching 🏋️‍♀️_`;
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
        card.innerHTML = `<span class="nutrition-icon" aria-hidden="true">🥑</span><p>${escapeHtml(String(session.nutrition_tip).trim())}</p>`;
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


function renderCoachSignature() {
    const footer = document.getElementById('coach-signature');
    if (!footer) return;
    footer.innerHTML = (COACH_NAME ? `Programme par ${escapeHtml(COACH_NAME)}` : '') + ` <span class="app-version">· v${escapeHtml(APP_VERSION)}</span>`;
}

function renderProgressionPanel() {
    const panel = document.getElementById('progression-modal-body') || document.getElementById('progression-panel');
    if (!panel || !globalData || !globalData.sessions) return;
    const { byExo, totalVolume } = getProgression1RMAndVolume();
    const badges = getProgressionBadges();

    let html = '';

    const mensurations = getMensurations();
    const poidsArr = getPoids();
    const vetement = getVetementTest();
    const lastM = latestByDate(mensurations);
    const lastP = latestByDate(poidsArr);
    const lastV = vetement.entries && vetement.entries.length ? latestByDate(vetement.entries) : null;
    const hasSuivi = lastM || lastP || (vetement.name && lastV);
    html += '<p class="progression-intro progression-section">Mensurations & Suivi</p>';
    html += '<div class="progression-suivi-block">';
    if (lastM) {
        const parts = [];
        if (lastM.tour_taille != null) parts.push(`Taille : ${lastM.tour_taille} cm`);
        if (lastM.tour_hanches != null) parts.push(`Hanches : ${lastM.tour_hanches} cm`);
        if (lastM.tour_poitrine != null) parts.push(`Poitrine : ${lastM.tour_poitrine} cm`);
        if (lastM.tour_cuisses != null) parts.push(`Cuisses : ${lastM.tour_cuisses} cm`);
        if (lastM.tour_bras != null) parts.push(`Bras : ${lastM.tour_bras} cm`);
        if (parts.length) html += `<p class="progression-suivi-line">📏 ${parts.join(' · ')}${lastM.date ? ' <span class="progression-suivi-date">(' + formatDateRelative(lastM.date) + ')</span>' : ''}</p>`;
    }
    if (lastP) html += `<p class="progression-suivi-line">⚖️ Poids : ${lastP.poids_kg} kg${lastP.date ? ' <span class="progression-suivi-date">(' + formatDateRelative(lastP.date) + ')</span>' : ''}</p>`;
    if (vetement.name && lastV) html += `<p class="progression-suivi-line">👕 ${vetement.name} : ${VETEMENT_FEELING_LABELS[lastV.feeling] || lastV.feeling}${lastV.date ? ' <span class="progression-suivi-date">(' + formatDateRelative(lastV.date) + ')</span>' : ''}</p>`;
    if (!hasSuivi) html += '<p class="progression-suivi-line progression-suivi-empty">Aucune donnée. Clique sur Editer pour ajouter tes mensurations, ton poids ou un vêtement test.</p>';
    if (hasSuivi) html += '<p class="progression-suivi-hint">Clique sur la zone pour voir l\'historique et tes progrès.</p>';
    html += '<button type="button" class="btn-suivi-editer" id="btn-suivi-editer">Editer</button>';
    html += '</div>';

    const exoNames1RM = Object.keys(byExo).filter(name => is1RMTrackedExercise(name) && (byExo[name].best1RM || 0) > 0);
    const sortedBy1RM = exoNames1RM.sort((a, b) => (byExo[b].best1RM || 0) - (byExo[a].best1RM || 0));
    if (sortedBy1RM.length > 0) {
        html += '<p class="progression-intro progression-section">Records 1RM (théorique)</p><ul class="progression-list progression-1rm-list">';
        sortedBy1RM.forEach(name => {
            const data = byExo[name];
            if (data.best1RM > 0) html += `<li class="progression-1rm-item"><span class="progression-item-name">${escapeHtml(name)}</span> <span class="progression-1rm-value">${data.best1RM} kg</span></li>`;
        });
        html += '</ul>';
    }

    if (totalVolume > 0 || badges.totalSessions > 0 || badges.streakWeeks > 0) {
        html += '<p class="progression-intro progression-section">Volume</p>';
        html += '<div class="progression-meta">';
        if (totalVolume > 0) html += `<span class="progression-meta-item">Poids total soulevé : <strong>${totalVolume} kg</strong></span>`;
        html += `<span class="progression-meta-item">Séances : <strong>${badges.totalSessions}</strong></span>`;
        if (badges.streakWeeks > 0) html += `<span class="progression-meta-item">Série : <strong>${badges.streakWeeks} sem.</strong></span>`;
        html += '</div>';
    }

    const trainingSec = getTrainingSeconds();
    html += '<p class="progression-intro progression-section">Temps à l\'entraînement</p>';
    const trainingHours = (trainingSec / 3600).toFixed(1).replace(/\.0$/, '');
    html += `<div class="progression-meta"><span class="progression-meta-item">Temps passé à l'entraînement : <strong>${trainingHours} h</strong></span></div>`;

    const counters = getCounters();
    const counterLabels = { burpees: 'Burpees', squats: 'Squats', gainage_seconds: 'Temps en gainage', pompes: 'Pompes', fentes: 'Fentes', escalier_seconds: 'Temps sur escalier' };
    const counterOrder = ['burpees', 'squats', 'gainage_seconds', 'escalier_seconds', 'pompes', 'fentes'];
    const hasCounters = counterOrder.some(k => (counters[k] || 0) > 0);
    if (hasCounters) {
        html += '<p class="progression-intro progression-section">Compteurs</p><ul class="progression-list progression-counters">';
        counterOrder.forEach(k => {
            const v = counters[k] || 0;
            if (v <= 0) return;
            const label = counterLabels[k] || k;
            const display = (k === 'gainage_seconds' || k === 'escalier_seconds') ? (v >= 60 ? (v / 60).toFixed(1) + ' min' : v + ' s') : v;
            html += '<li class="progression-item"><span class="progression-item-name">' + label + '</span> : <strong>' + display + '</strong></li>';
        });
        html += '</ul>';
    }

    if (!html) html = '<p class="progression-intro">Aucune donnée de progression pour l’instant.</p>';
    panel.innerHTML = html;
}

function initProgressionToggle() {
    const btn = document.getElementById('btn-progression-toggle');
    const overlay = document.getElementById('progression-overlay');
    if (!btn || !overlay) return;
    btn.addEventListener('click', () => {
        const isOpen = overlay.classList.contains('active');
        const willOpen = !isOpen;
        overlay.classList.toggle('active', willOpen);
        overlay.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
            renderProgressionPanel();
        }
    });
}

function closeProgressionModal() {
    const overlay = document.getElementById('progression-overlay');
    const btn = document.getElementById('btn-progression-toggle');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function openSuiviModal() {
    loadSuiviIntoModal();
    const overlay = document.getElementById('suivi-overlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }
}
function closeSuiviModal() {
    const overlay = document.getElementById('suivi-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }
}

function openSuiviHistoriqueModal() {
    const mensurations = getMensurations();
    const poidsArr = getPoids();
    const vetement = getVetementTest();
    const body = document.getElementById('suivi-historique-body');
    const overlay = document.getElementById('suivi-historique-overlay');
    if (!body || !overlay) return;
    let html = '';
    const firstM = oldestByDate(mensurations);
    const firstP = oldestByDate(poidsArr);
    if (mensurations.length > 0) {
        html += '<section class="suivi-section"><h3 class="suivi-section-title">📏 Mensurations</h3>';
        const mensurationsSorted = [...mensurations].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        mensurationsSorted.slice(0, SUIVI_HISTORY_MAX).forEach((m, i) => {
            const parts = [];
            if (m.tour_taille != null) {
                const delta = firstM && firstM.tour_taille != null ? (firstM.tour_taille - m.tour_taille) : 0;
                const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} cm</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} cm</span>` : '');
                parts.push(`Taille : ${m.tour_taille} cm${deltaStr}`);
            }
            if (m.tour_hanches != null) {
                const delta = firstM && firstM.tour_hanches != null ? (firstM.tour_hanches - m.tour_hanches) : 0;
                const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} cm</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} cm</span>` : '');
                parts.push(`Hanches : ${m.tour_hanches} cm${deltaStr}`);
            }
            if (m.tour_poitrine != null) {
                const delta = firstM && firstM.tour_poitrine != null ? (firstM.tour_poitrine - m.tour_poitrine) : 0;
                const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} cm</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} cm</span>` : '');
                parts.push(`Poitrine : ${m.tour_poitrine} cm${deltaStr}`);
            }
            if (m.tour_cuisses != null) {
                const delta = firstM && firstM.tour_cuisses != null ? (firstM.tour_cuisses - m.tour_cuisses) : 0;
                const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} cm</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} cm</span>` : '');
                parts.push(`Cuisses : ${m.tour_cuisses} cm${deltaStr}`);
            }
            if (m.tour_bras != null) {
                const delta = firstM && firstM.tour_bras != null ? (firstM.tour_bras - m.tour_bras) : 0;
                const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} cm</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} cm</span>` : '');
                parts.push(`Bras : ${m.tour_bras} cm${deltaStr}`);
            }
            if (parts.length) html += `<p class="suivi-hist-line">${parts.join(' · ')} <span class="progression-suivi-date">${formatDateRelative(m.date)}</span></p>`;
        });
        html += '</section>';
    }
    if (poidsArr.length > 0) {
        html += '<section class="suivi-section"><h3 class="suivi-section-title">⚖️ Poids</h3>';
        const poidsSorted = [...poidsArr].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        poidsSorted.slice(0, SUIVI_HISTORY_MAX).forEach((p) => {
            const delta = firstP && firstP.poids_kg != null ? (firstP.poids_kg - p.poids_kg) : 0;
            const deltaStr = delta > 0 ? ` <span class="suivi-progress">−${delta} kg</span>` : (delta < 0 ? ` <span class="suivi-regress">+${Math.abs(delta)} kg</span>` : '');
            html += `<p class="suivi-hist-line">${p.poids_kg} kg${deltaStr} <span class="progression-suivi-date">${formatDateRelative(p.date)}</span></p>`;
        });
        html += '</section>';
    }
    if (vetement.entries && vetement.entries.length > 0) {
        html += '<section class="suivi-section"><h3 class="suivi-section-title">👕 ' + (vetement.name ? vetement.name : 'Vêtement test') + '</h3>';
        const entriesSorted = [...vetement.entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        entriesSorted.slice(0, SUIVI_HISTORY_MAX).forEach((e) => {
            html += `<p class="suivi-hist-line">${VETEMENT_FEELING_LABELS[e.feeling] || e.feeling}${e.note ? ' — ' + e.note : ''} <span class="progression-suivi-date">${formatDateRelative(e.date)}</span></p>`;
        });
        html += '</section>';
    }
    if (!html) html = '<p class="progression-intro">Aucun historique pour l’instant.</p>';
    body.innerHTML = html;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}
function closeSuiviHistoriqueModal() {
    const overlay = document.getElementById('suivi-historique-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }
}

function loadSuiviIntoModal() {
    const prefs = getSuiviHeader();
    const el = (id) => document.getElementById(id);
    if (el('suivi-show-poids')) el('suivi-show-poids').checked = !!prefs.show_poids;
    if (el('suivi-show-taille')) el('suivi-show-taille').checked = !!prefs.show_taille;
    if (el('suivi-show-hanches')) el('suivi-show-hanches').checked = !!prefs.show_hanches;
    if (el('suivi-show-poitrine')) el('suivi-show-poitrine').checked = !!prefs.show_poitrine;
    if (el('suivi-show-cuisses')) el('suivi-show-cuisses').checked = !!prefs.show_cuisses;
    if (el('suivi-show-bras')) el('suivi-show-bras').checked = !!prefs.show_bras;
    if (el('suivi-show-vetement')) el('suivi-show-vetement').checked = !!prefs.show_vetement;
    if (el('suivi-objectif-poids')) el('suivi-objectif-poids').value = prefs.objectif_poids != null ? prefs.objectif_poids : '';
    if (el('suivi-objectif-taille')) el('suivi-objectif-taille').value = prefs.objectif_taille != null ? prefs.objectif_taille : '';
    if (el('suivi-objectif-hanches')) el('suivi-objectif-hanches').value = prefs.objectif_hanches != null ? prefs.objectif_hanches : '';
    if (el('suivi-objectif-poitrine')) el('suivi-objectif-poitrine').value = prefs.objectif_poitrine != null ? prefs.objectif_poitrine : '';
    if (el('suivi-objectif-cuisses')) el('suivi-objectif-cuisses').value = prefs.objectif_cuisses != null ? prefs.objectif_cuisses : '';
    if (el('suivi-objectif-bras')) el('suivi-objectif-bras').value = prefs.objectif_bras != null ? prefs.objectif_bras : '';
    const vet = getVetementTest();
    if (el('suivi-vetement-name')) el('suivi-vetement-name').value = vet.name || '';
}
function initSuiviModal() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.btn-suivi-editer')) {
            e.preventDefault();
            closeProgressionModal();
            openSuiviModal();
        }
        if (e.target.closest('.progression-suivi-block') && !e.target.closest('.btn-suivi-editer')) {
            e.preventDefault();
            closeProgressionModal();
            openSuiviHistoriqueModal();
        }
    });
    const overlay = document.getElementById('suivi-overlay');
    const closeBtn = overlay?.querySelector('.suivi-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSuiviModal);
    document.getElementById('btn-suivi-save-mensurations')?.addEventListener('click', () => {
        const date = new Date().toISOString().slice(0, 10);
        const tour_taille = document.getElementById('suivi-tour-taille')?.value?.trim();
        const tour_hanches = document.getElementById('suivi-tour-hanches')?.value?.trim();
        const tour_poitrine = document.getElementById('suivi-tour-poitrine')?.value?.trim();
        const tour_cuisses = document.getElementById('suivi-tour-cuisses')?.value?.trim();
        const tour_bras = document.getElementById('suivi-tour-bras')?.value?.trim();
        if (!tour_taille && !tour_hanches && !tour_poitrine && !tour_cuisses && !tour_bras) return;
        const parseTour = (v) => v ? parseFloat(v.replace(',', '.')) : null;
        const vTaille = parseTour(tour_taille), vHanches = parseTour(tour_hanches), vPoitrine = parseTour(tour_poitrine), vCuisses = parseTour(tour_cuisses), vBras = parseTour(tour_bras);
        if ([vTaille, vHanches, vPoitrine, vCuisses, vBras].some(v => v != null && !isValidSuiviValue(v, 'tour'))) {
            showToast('Valeur invalide : les mensurations doivent être entre 15 et 250 cm.');
            return;
        }
        const arr = getMensurations();
        arr.push({
            date: date,
            recordedAt: new Date().toISOString(),
            tour_taille: vTaille,
            tour_hanches: vHanches,
            tour_poitrine: vPoitrine,
            tour_cuisses: vCuisses,
            tour_bras: vBras
        });
        arr.sort((a, b) => (b.recordedAt || b.date || '').localeCompare(a.recordedAt || a.date || ''));
        setMensurations(arr);
        document.getElementById('suivi-tour-taille').value = '';
        document.getElementById('suivi-tour-hanches').value = '';
        document.getElementById('suivi-tour-poitrine').value = '';
        document.getElementById('suivi-tour-cuisses').value = '';
        document.getElementById('suivi-tour-bras').value = '';
        renderProgressionPanel();
        renderSuiviHeaderBar();
        showToast('Mensurations enregistrées');
    });
    document.getElementById('btn-suivi-save-poids')?.addEventListener('click', () => {
        const date = new Date().toISOString().slice(0, 10);
        const poids = document.getElementById('suivi-poids')?.value?.trim();
        if (!poids) return;
        const kg = parseFloat(poids.replace(',', '.'));
        if (isNaN(kg)) return;
        if (!isValidSuiviValue(kg, 'poids')) {
            showToast('Valeur invalide : le poids doit être entre 20 et 300 kg.');
            return;
        }
        const arr = getPoids();
        arr.push({ date: date, recordedAt: new Date().toISOString(), poids_kg: kg });
        arr.sort((a, b) => (b.recordedAt || b.date || '').localeCompare(a.recordedAt || a.date || ''));
        setPoids(arr);
        document.getElementById('suivi-poids').value = '';
        renderProgressionPanel();
        renderSuiviHeaderBar();
        showToast('Poids enregistré');
    });
    document.getElementById('btn-suivi-save-vetement')?.addEventListener('click', () => {
        const name = document.getElementById('suivi-vetement-name')?.value?.trim();
        const feeling = document.getElementById('suivi-vetement-feeling')?.value?.trim();
        const date = new Date().toISOString().slice(0, 10);
        const note = document.getElementById('suivi-vetement-note')?.value?.trim();
        if (!name || !feeling) return;
        const vet = getVetementTest();
        if (!vet.name) vet.name = name;
        vet.entries = vet.entries || [];
        vet.entries.push({ date: date, recordedAt: new Date().toISOString(), feeling: feeling, note: note || null });
        vet.entries.sort((a, b) => (b.recordedAt || b.date || '').localeCompare(a.recordedAt || a.date || ''));
        setVetementTest(vet);
        document.getElementById('suivi-vetement-feeling').value = '';
        document.getElementById('suivi-vetement-note').value = '';
        renderProgressionPanel();
        renderSuiviHeaderBar();
        showToast('Vêtement test enregistré');
    });
    document.getElementById('btn-suivi-save-prefs')?.addEventListener('click', () => {
        const prefs = getSuiviHeader();
        prefs.show_poids = document.getElementById('suivi-show-poids')?.checked ?? false;
        prefs.show_taille = document.getElementById('suivi-show-taille')?.checked ?? false;
        prefs.show_hanches = document.getElementById('suivi-show-hanches')?.checked ?? false;
        prefs.show_poitrine = document.getElementById('suivi-show-poitrine')?.checked ?? false;
        prefs.show_cuisses = document.getElementById('suivi-show-cuisses')?.checked ?? false;
        prefs.show_bras = document.getElementById('suivi-show-bras')?.checked ?? false;
        prefs.show_vetement = document.getElementById('suivi-show-vetement')?.checked ?? false;
        const op = document.getElementById('suivi-objectif-poids')?.value?.trim();
        const ot = document.getElementById('suivi-objectif-taille')?.value?.trim();
        const oh = document.getElementById('suivi-objectif-hanches')?.value?.trim();
        const opr = document.getElementById('suivi-objectif-poitrine')?.value?.trim();
        const ocu = document.getElementById('suivi-objectif-cuisses')?.value?.trim();
        const obr = document.getElementById('suivi-objectif-bras')?.value?.trim();
        prefs.objectif_poids = op ? parseFloat(op.replace(',', '.')) : null;
        prefs.objectif_taille = ot ? parseFloat(ot.replace(',', '.')) : null;
        prefs.objectif_hanches = oh ? parseFloat(oh.replace(',', '.')) : null;
        prefs.objectif_poitrine = opr ? parseFloat(opr.replace(',', '.')) : null;
        prefs.objectif_cuisses = ocu ? parseFloat(ocu.replace(',', '.')) : null;
        prefs.objectif_bras = obr ? parseFloat(obr.replace(',', '.')) : null;
        setSuiviHeader(prefs);
        renderSuiviHeaderBar();
        showToast('Préférences enregistrées');
    });
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeSuiviModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('suivi-historique-overlay')?.classList.contains('active')) closeSuiviHistoriqueModal();
        else if (overlay?.classList.contains('active')) closeSuiviModal();
    });
    const overlayHist = document.getElementById('suivi-historique-overlay');
    overlayHist?.querySelector('.suivi-historique-close')?.addEventListener('click', closeSuiviHistoriqueModal);
    overlayHist?.addEventListener('click', (e) => { if (e.target === overlayHist) closeSuiviHistoriqueModal(); });
}
function progressPct(start, current, goal) {
    if (start == null || current == null || goal == null) return 0;
    if (Math.abs(goal - start) < 1e-6) return current === goal ? 100 : 0;
    if (goal < start) return Math.min(100, Math.max(0, ((start - current) / (start - goal)) * 100));
    return Math.min(100, Math.max(0, ((current - start) / (goal - start)) * 100));
}
/** Classe CSS et phrase courte selon le % de progression (0-100). */
function suiviProgressState(pct) {
    const n = Math.round(pct);
    if (n >= 100) return { class: 'suivi-header-item--done', message: 'Objectif atteint !' };
    if (n >= 75) return { class: 'suivi-header-item--close', message: 'Plus que ' + (100 - n) + '% !' };
    if (n >= 50) return { class: 'suivi-header-item--mid', message: n === 50 ? '50% — à mi-chemin !' : n + '% — plus que la moitié !' };
    if (n > 0) return { class: 'suivi-header-item--start', message: n + '% — chaque pas compte.' };
    return { class: 'suivi-header-item--start', message: 'C\'est parti !' };
}

function latestByDate(arr, dateKey) {
    if (!arr || !arr.length) return null;
    dateKey = dateKey || 'date';
    return arr.reduce((best, cur) => {
        const curDate = cur[dateKey] || '';
        return (!best || (curDate || '').localeCompare(best[dateKey] || '') > 0) ? cur : best;
    }, null);
}
/** Retourne l'entrée la plus récente (par recordedAt si présent, sinon par date). Plusieurs valeurs le même jour = la dernière enregistrée. */
function latestByRecordedAt(arr, dateKey) {
    if (!arr || !arr.length) return null;
    dateKey = dateKey || 'date';
    return arr.reduce((best, cur) => {
        const curTs = cur.recordedAt || (cur[dateKey] ? cur[dateKey] + 'T00:00:00.000Z' : '');
        const bestTs = best ? (best.recordedAt || (best[dateKey] ? best[dateKey] + 'T00:00:00.000Z' : '')) : '';
        return (!best || (curTs || '').localeCompare(bestTs || '') > 0) ? cur : best;
    }, null);
}
function oldestByDate(arr, dateKey) {
    if (!arr || !arr.length) return null;
    dateKey = dateKey || 'date';
    return arr.reduce((best, cur) => {
        const curDate = cur[dateKey] || '';
        return (!best || (curDate || '').localeCompare(best[dateKey] || '') < 0) ? cur : best;
    }, null);
}

function renderSuiviHeaderBar() {
    const bar = document.getElementById('suivi-header-bar');
    if (!bar) return;
    const prefs = getSuiviHeader();
    const mensurations = getMensurations();
    const poidsArr = getPoids();
    const vetement = getVetementTest();
    const lastM = latestByRecordedAt(mensurations);
    const lastP = latestByRecordedAt(poidsArr);
    const firstP = oldestByDate(poidsArr);
    const firstM = oldestByDate(mensurations);
    const lastV = vetement.entries && vetement.entries.length ? latestByRecordedAt(vetement.entries) : null;
    const items = [];
    const push = (label, progress, state, isVetement = false) => {
        const pct = Math.round(progress);
        if (isVetement) items.push(`<div class="suivi-header-item suivi-header-vetement"><span class="suivi-header-label">${label}</span></div>`);
        else items.push(`<div class="suivi-header-item ${state.class}"><span class="suivi-header-label">${label}</span><div class="suivi-header-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="suivi-header-fill" style="width:${pct}%"></div><span class="suivi-header-pct">${pct}%</span></div></div>`);
    };
    if (prefs.show_poids && prefs.objectif_poids != null && lastP != null) {
        const current = lastP.poids_kg;
        const goal = prefs.objectif_poids;
        let start = current;
        // Si un poids de base est défini dans la fiche client, on l'utilise comme point de départ
        const base = globalData && typeof globalData.baseline_weight_kg === 'number'
            ? globalData.baseline_weight_kg
            : null;
        if (base != null && !isNaN(base) && base > 0) {
            start = base;
        } else if (firstP && firstP.poids_kg != null) {
            start = firstP.poids_kg;
        }
        const pct = progressPct(start, current, goal);
        push(`⚖️ Poids ${current} kg → ${goal} kg`, pct, suiviProgressState(pct));
    }
    if (prefs.show_taille && prefs.objectif_taille != null && lastM != null && lastM.tour_taille != null) {
        const current = lastM.tour_taille, goal = prefs.objectif_taille, start = firstM && firstM.tour_taille != null ? firstM.tour_taille : current;
        push(`📏 Taille ${current} cm → ${goal} cm`, progressPct(start, current, goal), suiviProgressState(progressPct(start, current, goal)));
    }
    if (prefs.show_hanches && prefs.objectif_hanches != null && lastM != null && lastM.tour_hanches != null) {
        const current = lastM.tour_hanches, goal = prefs.objectif_hanches, start = firstM && firstM.tour_hanches != null ? firstM.tour_hanches : current;
        push(`📐 Hanches ${current} cm → ${goal} cm`, progressPct(start, current, goal), suiviProgressState(progressPct(start, current, goal)));
    }
    if (prefs.show_poitrine && prefs.objectif_poitrine != null && lastM != null && lastM.tour_poitrine != null) {
        const current = lastM.tour_poitrine, goal = prefs.objectif_poitrine, start = firstM && firstM.tour_poitrine != null ? firstM.tour_poitrine : current;
        push(`📐 Poitrine ${current} cm → ${goal} cm`, progressPct(start, current, goal), suiviProgressState(progressPct(start, current, goal)));
    }
    if (prefs.show_cuisses && prefs.objectif_cuisses != null && lastM != null && lastM.tour_cuisses != null) {
        const current = lastM.tour_cuisses, goal = prefs.objectif_cuisses, start = firstM && firstM.tour_cuisses != null ? firstM.tour_cuisses : current;
        push(`🦵 Cuisses ${current} cm → ${goal} cm`, progressPct(start, current, goal), suiviProgressState(progressPct(start, current, goal)));
    }
    if (prefs.show_bras && prefs.objectif_bras != null && lastM != null && lastM.tour_bras != null) {
        const current = lastM.tour_bras, goal = prefs.objectif_bras, start = firstM && firstM.tour_bras != null ? firstM.tour_bras : current;
        push(`💪 Bras ${current} cm → ${goal} cm`, progressPct(start, current, goal), suiviProgressState(progressPct(start, current, goal)));
    }
    if (prefs.show_vetement && vetement.name && lastV) {
        const text = lastV.feeling ? `${vetement.name} : ${lastV.feeling}` : vetement.name;
        items.push(`<div class="suivi-header-item suivi-header-vetement"><span class="suivi-header-label">👕 ${escapeHtml(text)}</span></div>`);
    }
    const html = items.slice(0, SUIVI_HEADER_MAX).join('');
    if (html) {
        // Contenu principal (objectif compact) + petite icône d’accès au panneau détaillé
        bar.innerHTML = html + '<button type="button" class="suivi-header-icon" aria-label="Voir le détail de mon suivi">i</button>';
        bar.hidden = false;
        // Rendre tout le bandeau cliquable / accessible pour ouvrir le suivi
        bar.setAttribute('role', 'button');
        bar.setAttribute('tabindex', '0');
        bar.setAttribute('aria-label', 'Voir mon suivi détaillé (mensurations, poids, vêtement test)');
        if (!bar.dataset.suiviBound) {
            bar.addEventListener('click', (e) => {
                // Si on clique n’importe où dans le bandeau, on ouvre le panneau de suivi
                e.preventDefault();
                openSuiviModal();
            });
            bar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSuiviModal();
                }
            });
            bar.dataset.suiviBound = '1';
        }
    } else {
        bar.innerHTML = '';
        bar.hidden = true;
    }
}

function initFocusMode() {
    const btn = document.getElementById('btn-focus-mode');
    const btnPrev = document.getElementById('btn-guided-prev');
    const btnNext = document.getElementById('btn-guided-next');
    const btnExit = document.getElementById('btn-guided-exit');
    if (!btn) return;
    if (isGuidedMode()) {
        document.body.classList.add('guided-mode');
        guidedViewIndex = 0;
        setTimeout(() => { guidedViewIndex = getFirstIncompleteIndex(); updateGuidedMode(); }, 100);
        btn.textContent = 'Vue complète';
        btn.setAttribute('aria-label', 'Revenir à la vue complète');
        btn.title = 'Sortir du mode focus';
    }
    btn.addEventListener('click', () => {
        const on = !document.body.classList.contains('guided-mode');
        document.body.classList.toggle('guided-mode', on);
        setGuidedMode(on);
        if (on) {
            guidedViewIndex = getFirstIncompleteIndex();
            updateGuidedMode();
            document.querySelector('.exercise-card.guided-current')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btn.textContent = 'Vue complète';
            btn.setAttribute('aria-label', 'Revenir à la vue complète');
            btn.title = 'Sortir du mode focus';
        } else {
            const nav = document.getElementById('guided-nav');
            if (nav) nav.hidden = true;
            document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('guided-current'));
            btn.textContent = '◐ Focus';
            btn.setAttribute('aria-label', 'Mode focus : un exercice à la fois, valide tes séries en un clic');
            btn.title = 'Un exercice à la fois, idéal en plein effort';
        }
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
    if (btnExit) btnExit.addEventListener('click', () => {
        document.body.classList.remove('guided-mode');
        setGuidedMode(false);
        const nav = document.getElementById('guided-nav');
        if (nav) nav.hidden = true;
        document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('guided-current'));
        if (btn) {
            btn.textContent = '◐ Focus';
            btn.setAttribute('aria-label', 'Mode focus : un exercice à la fois, valide tes séries en un clic');
            btn.title = 'Un exercice à la fois, idéal en plein effort';
        }
    });
}

function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('setting-sound').checked = getSettingSound();
    const loudCheckbox = document.getElementById('setting-sound-loud');
    if (loudCheckbox) loudCheckbox.checked = getSettingLoudBeep();
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
    const loudCheckbox = document.getElementById('setting-sound-loud');
    if (loudCheckbox) setSettingLoudBeep(loudCheckbox.checked);
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
        if (!confirm('Effacer toutes les données de ce programme (séances terminées, charges, notes, mensurations, poids, vêtement test, compteurs et objectifs débloqués) ? Cette action est irréversible.')) return;
        localStorage.removeItem('fitapp_' + clientID);
        localStorage.removeItem(COMPLETED_KEY);
        localStorage.removeItem(KEY_CHARGE_HISTORY);
        // Remettre à zéro les compteurs (burpees, squats, etc.) et milestones pour pouvoir les redéclencher
        localStorage.removeItem(KEY_COUNTERS);
        localStorage.removeItem(KEY_MILESTONES);
        localStorage.removeItem(KEY_TRAINING_SECONDS);
        setCoachNote('');
        setMensurations([]);
        setPoids([]);
        setVetementTest({ name: '', entries: [] });
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
        renderSuiviHeaderBar();
    });
    const exportBtn = document.getElementById('btn-export-data');
    const importBtn = document.getElementById('btn-import-data');
    const inputImport = document.getElementById('input-import-data');
    if (exportBtn) exportBtn.addEventListener('click', exportClientData);
    if (importBtn && inputImport) {
        importBtn.addEventListener('click', () => inputImport.click());
        inputImport.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data || typeof data !== 'object') throw new Error('Fichier invalide');
                    if (!confirm('Écraser les données actuelles ? Les données importées remplaceront tout pour ce programme.')) return;
                    importClientData(data);
                    closeSettings();
                    showToast('Données importées. Rechargement…');
                    setTimeout(() => location.reload(), 800);
                } catch (err) {
                    showToast('Fichier invalide ou corrompu.');
                }
            };
            reader.readAsText(file, 'utf-8');
        });
    }
}

function getExportKeys() {
    return [
        'fitapp_' + clientID,
        COMPLETED_KEY,
        KEY_CHARGE_HISTORY,
        KEY_SESSION_DATE_OVERRIDES,
        KEY_COUNTERS,
        KEY_MILESTONES,
        KEY_TRAINING_SECONDS,
        KEY_MENSURATIONS,
        KEY_POIDS,
        KEY_VETEMENT_TEST,
        KEY_SUIVI_HEADER,
        KEY_SOUND,
        KEY_THEME,
        KEY_COACH_NOTE,
        KEY_NOTIF_DAY,
        KEY_NOTIF_ENABLED,
        KEY_INSTALL_DISMISSED,
        KEY_GUIDED_MODE
    ];
}

function exportClientData() {
    const keys = getExportKeys();
    const data = { meta: { clientID, exportDate: new Date().toISOString() } };
    keys.forEach(k => {
        const v = localStorage.getItem(k);
        if (v != null) data[k] = v;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coaching-backup-${clientID}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Sauvegarde téléchargée.');
}

function importClientData(data) {
    const keys = getExportKeys();
    keys.forEach(k => {
        if (data[k] != null && typeof data[k] === 'string') {
            try {
                localStorage.setItem(k, data[k]);
            } catch (_) { /* quota or other */ }
            }
    });
}

let deferredInstallPrompt = null;
function initInstallPrompt() {
    const banner = document.getElementById('install-banner');
    const btnInstall = document.getElementById('btn-install-app');
    const btnDismiss = document.getElementById('btn-dismiss-install');
    if (!banner || !btnInstall || !btnDismiss) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // Cas iOS : pas de beforeinstallprompt, on affiche une bannière pédagogique spécifique
    if (isIOS() && !isStandalone && !isInstallDismissed()) {
        const textSpan = banner.querySelector('.install-banner span:nth-of-type(2)') || banner.querySelector('span:nth-of-type(2)');
        if (textSpan) {
            textSpan.innerHTML = `Pour installer sur iPhone : ouvre <strong>Partager</strong> puis choisis <strong>“Sur l'écran d'accueil”</strong>.`;
        }
        // On masque le bouton "Installer" impossible à déclencher sur iOS
        btnInstall.style.display = 'none';
        btnDismiss.textContent = 'Compris';
        banner.hidden = false;
        btnDismiss.addEventListener('click', () => {
            setInstallDismissed();
            banner.hidden = true;
        });
        return;
    }

    if (isInstallDismissed() || isStandalone) return;
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
    let firstIncomplete = -1;
    for (let i = 0; i < cards.length; i++) {
        const cb = cards[i].querySelector('.set-checkbox:not(:checked)');
        if (cb) {
            firstIncomplete = i;
            break;
        }
    }
    if (firstIncomplete < 0) return Math.max(0, cards.length - 1);
    const card = cards[firstIncomplete];
    if (card.dataset.circuit === '1') {
        for (let j = firstIncomplete; j >= 0; j--) {
            if (cards[j].dataset.circuitStart === '1') return j;
        }
    }
    return firstIncomplete;
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

// --- MODAL COHÉRENCE CARDIAQUE (Pause Respiration) ---
let breathingPhaseInterval = null;
let breathingCountdownInterval = null;
let breathingCountdownSeconds = 300; // 5 min
let breathingAudioCtx = null;
const BREATHING_PHASE_DURATION_MS = 4000;
const BREATHING_PHASES = [
    { label: 'Inspire...', scale: 1.6, beepType: 'normal' },
    { label: 'Retiens...', scale: 1.6, beepType: 'hold' },
    { label: 'Expire...',  scale: 0.8, beepType: 'normal' },
    { label: 'Retiens...', scale: 0.8, beepType: 'hold' },
];
let breathingPhaseIndex = 0;
let breathingHoldTimeout = null;

function playBreathingBeep(type) {
    if (!getSettingSound()) return;
    try {
        if (!breathingAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            breathingAudioCtx = new Ctx();
        }
        const ctx = breathingAudioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const isHold = type === 'hold';
        const duration = isHold ? 0.18 : 0.12;
        const freq = isHold ? 520 : 620;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gain.gain.linearRampToValueAtTime(0.0, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    } catch (_) {
        // ignore audio errors gracefully
    }
}

function openBreathingModal() {
    const overlay = document.getElementById('breathing-modal-overlay');
    const stepIntro = document.getElementById('breathing-step-intro');
    const stepExercise = document.getElementById('breathing-step-exercise');
    const bubble = document.getElementById('breathing-bubble');
    const phaseText = document.getElementById('breathing-phase-text');
    const timerEl = document.getElementById('breathing-timer');
    const finishEl = document.getElementById('breathing-finish-text');
    if (!overlay || !stepIntro || !stepExercise) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    stepIntro.hidden = false;
    stepExercise.hidden = true;
    if (bubble) {
        bubble.style.transform = 'scale(0.8)';
    }
    if (phaseText) phaseText.textContent = 'Inspire...';
    breathingCountdownSeconds = 300;
    if (timerEl) timerEl.textContent = '5:00';
    if (finishEl) { finishEl.hidden = true; }
    if (breathingPhaseInterval) clearInterval(breathingPhaseInterval);
    if (breathingCountdownInterval) clearInterval(breathingCountdownInterval);
}

function closeBreathingModal() {
    const overlay = document.getElementById('breathing-modal-overlay');
    const stepIntro = document.getElementById('breathing-step-intro');
    const stepExercise = document.getElementById('breathing-step-exercise');
    const bubble = document.getElementById('breathing-bubble');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if (stepIntro) stepIntro.hidden = false;
    if (stepExercise) stepExercise.hidden = true;
    if (bubble) {
        bubble.style.transform = 'scale(0.8)';
    }
    if (breathingPhaseInterval) { clearInterval(breathingPhaseInterval); breathingPhaseInterval = null; }
    if (breathingCountdownInterval) { clearInterval(breathingCountdownInterval); breathingCountdownInterval = null; }
    if (breathingHoldTimeout) { clearTimeout(breathingHoldTimeout); breathingHoldTimeout = null; }
}

function initBreathingModal() {
    const overlay = document.getElementById('breathing-modal-overlay');
    const btnStart = document.getElementById('btn-breathing-start');
    const btnClose = document.getElementById('breathing-close');
    const stepIntro = document.getElementById('breathing-step-intro');
    const stepExercise = document.getElementById('breathing-step-exercise');
    const bubble = document.getElementById('breathing-bubble');
    const phaseText = document.getElementById('breathing-phase-text');
    const timerEl = document.getElementById('breathing-timer');
    const finishEl = document.getElementById('breathing-finish-text');
    if (!overlay || !btnStart || !btnClose) return;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeBreathingModal();
    });
    btnStart.addEventListener('click', () => {
        stepIntro.hidden = true;
        stepExercise.hidden = true;
        stepExercise.hidden = false;
        breathingPhaseIndex = 0;
        if (bubble) {
            bubble.style.transition = 'transform 4s ease-in-out';
            bubble.style.transform = `scale(${BREATHING_PHASES[breathingPhaseIndex].scale})`;
        }
        if (phaseText) phaseText.textContent = BREATHING_PHASES[breathingPhaseIndex].label;
        breathingCountdownSeconds = 300;
        if (timerEl) timerEl.textContent = '5:00';
        if (finishEl) { finishEl.hidden = true; }
        if (breathingPhaseInterval) clearInterval(breathingPhaseInterval);
        playBreathingBeep(BREATHING_PHASES[breathingPhaseIndex].beepType);
        breathingPhaseInterval = setInterval(() => {
            breathingPhaseIndex = (breathingPhaseIndex + 1) % BREATHING_PHASES.length;
            const phase = BREATHING_PHASES[breathingPhaseIndex];
            if (phaseText) phaseText.textContent = phase.label;
            if (breathingHoldTimeout) { clearTimeout(breathingHoldTimeout); breathingHoldTimeout = null; }
            if (bubble) {
                if (phase.label.startsWith('Retiens')) {
                    const base = phase.scale;
                    bubble.style.transition = 'transform 2s ease-in-out';
                    // petit gonflement
                    bubble.style.transform = `scale(${base * 1.04})`;
                    breathingHoldTimeout = setTimeout(() => {
                        // petit dégonflement
                        bubble.style.transform = `scale(${base * 0.96})`;
                    }, BREATHING_PHASE_DURATION_MS / 2);
                } else {
                    // phases Inspire / Expire : grosse variation
                    bubble.style.transition = 'transform 4s ease-in-out';
                    bubble.style.transform = `scale(${phase.scale})`;
                }
            }
            playBreathingBeep(phase.beepType);
        }, BREATHING_PHASE_DURATION_MS);
        if (breathingCountdownInterval) clearInterval(breathingCountdownInterval);
        breathingCountdownInterval = setInterval(() => {
            breathingCountdownSeconds--;
            if (breathingCountdownSeconds <= 0) {
                breathingCountdownSeconds = 0;
                clearInterval(breathingCountdownInterval);
                breathingCountdownInterval = null;
                if (breathingPhaseInterval) { clearInterval(breathingPhaseInterval); breathingPhaseInterval = null; }
                if (finishEl) finishEl.hidden = false;
            }
            if (timerEl) {
                const m = Math.floor(breathingCountdownSeconds / 60);
                const s = breathingCountdownSeconds % 60;
                timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
            }
        }, 1000);
    });
    btnClose.addEventListener('click', closeBreathingModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeBreathingModal();
    });
}

// --- DÉLÉGATION D'ÉVÉNEMENTS (remplace les onclick inline) ---
document.body.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) { closeModal(); return; }
    if (e.target.closest('#btn-send-whatsapp')) { sendToWhatsapp(); return; }
    const recoveryBtn = e.target.closest('.btn-recovery-video');
    if (recoveryBtn) {
        const url = recoveryBtn.getAttribute('data-recovery-url') || DEFAULT_RECOVERY_VIDEO_URL;
        if (url) window.open(url, '_blank');
        return;
    }
    const pauseRespirationBtn = e.target.closest('.btn-pause-respiration');
    if (pauseRespirationBtn) {
        e.preventDefault();
        openBreathingModal();
        return;
    }
    const moveSessionBtn = e.target.closest('.btn-move-session');
    if (moveSessionBtn && globalData && globalData.sessions) {
        e.preventDefault();
        const sessions = globalData.sessions;
        const idx = sessions.findIndex((s, i) => (s.id || `session_${i}`) === currentSessionId);
        if (idx === -1) return;
        moveSessionMode = !moveSessionMode;
        if (moveSessionMode) {
            moveSessionSourceIndex = idx;
            moveSessionSourceId = sessions[idx].id || `session_${idx}`;
            document.body.classList.add('calendar-move-mode');
            showToast('Choisis un jour libre pour déplacer la séance.');
        } else {
            moveSessionSourceIndex = -1;
            moveSessionSourceId = null;
            document.body.classList.remove('calendar-move-mode');
        }
        return;
    }
    const closeProgBtn = e.target.closest('.close-progression');
    const progOverlay = document.getElementById('progression-overlay');
    if (closeProgBtn || (progOverlay && e.target === progOverlay)) {
        closeProgressionModal();
        return;
    }
    if (e.target.closest('[data-reset-session]')) { resetCurrentSession(); return; }
    const headerAgendaBtn = e.target.closest('#btn-add-to-agenda');
    if (headerAgendaBtn) {
        e.preventDefault();
        showAddToCalendarMenu(headerAgendaBtn);
        return;
    }
    const checkTechniqueBtn = e.target.closest('.btn-check-technique');
    if (checkTechniqueBtn) {
        const msg = checkTechniqueBtn.getAttribute('data-wa-msg') || '';
        if (msg) window.open(`https://wa.me/${COACH_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        return;
    }
    const altBtn = e.target.closest('.btn-alternative');
    if (altBtn) { e.stopPropagation(); swapExerciseAlternative(altBtn); return; }
    const warmupCell = e.target.closest('.set-wrapper-warmup-only');
    if (warmupCell) {
        e.preventDefault();
        e.stopPropagation();
        showWarmupGenerator(warmupCell.dataset.chargeId, warmupCell.dataset.exoName || 'cet exercice');
        return;
    }
    const rpeBtn = e.target.closest('.btn-rpe-badge');
    if (rpeBtn) { e.stopPropagation(); showRpeTooltip(rpeBtn); return; }
    const activeTimerBtn = e.target.closest('.active-timer-btn');
    if (activeTimerBtn) {
        e.stopPropagation();
        if (activeTimerBtn.classList.contains('active')) {
            if (activeTimerBtn.dataset.activeTimerPaused !== undefined) startActiveTimer(activeTimerBtn);
            else toggleActiveTimerPause(activeTimerBtn);
        } else {
            startActiveTimer(activeTimerBtn);
        }
        return;
    }
    const header = e.target.closest('.exercise-header');
    if (header) { toggleCard(header); return; }
    const timerBtn = e.target.closest('.timer-btn');
    if (timerBtn && timerBtn.dataset.rest !== undefined) {
        const clickedClose = e.target.closest('.timer-close');
        if (clickedClose) {
            /* Vrai clic sur la croix = arrêter / supprimer le chrono */
            e.stopPropagation();
            if (timerBtn.classList.contains('active')) stopTimer(timerBtn);
            return;
        }
        /* Clic sur le timer (pas sur la croix) = pause ou démarrer */
        e.stopPropagation();
        if (timerBtn.classList.contains('active')) {
            if (timerBtn.dataset.timerPaused) startTimer(timerBtn, parseInt(timerBtn.dataset.timerPaused, 10) || 60);
            else toggleTimerPause(timerBtn);
        } else {
            const n = parseInt(timerBtn.dataset.rest, 10);
            startTimer(timerBtn, (Number.isFinite(n) && n >= 0) ? n : 60);
        }
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
            const n = parseInt(timerBtn.dataset.rest, 10);
            startTimer(timerBtn, (Number.isFinite(n) && n >= 0) ? n : 60);
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
        // synchroniser la couleur du thumb avec la position (0–10)
        const min = parseInt(e.target.min, 10);
        const max = parseInt(e.target.max, 10);
        const val = parseInt(e.target.value, 10);
        const lo = isNaN(min) ? 0 : min;
        const hi = isNaN(max) || max === lo ? lo + 10 : max;
        const v = isNaN(val) ? (lo + hi) / 2 : val;
        const ratio = (v - lo) / (hi - lo || 1);
        const color = sliderColorForRatio(ratio);
        e.target.style.setProperty('--slider-thumb-color', color);
    }
    if (e.target.id === 'coach-note-free') setCoachNote(e.target.value);
});
document.body.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const settings = document.getElementById('settings-overlay');
        if (settings && settings.classList.contains('active')) { closeSettings(); e.preventDefault(); }
        const progOverlay = document.getElementById('progression-overlay');
        if (progOverlay && progOverlay.classList.contains('active')) { closeProgressionModal(); e.preventDefault(); }
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
    document.addEventListener('DOMContentLoaded', () => {
        initDarkMode();
        initHeaderMenu();
        initScoreSliderColors();
    });
} else {
    initDarkMode();
    initHeaderMenu();
    initScoreSliderColors();
}