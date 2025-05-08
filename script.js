import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDm1Qj95CzbgDyndTVKYGM5KqIerEkuD0w",
    authDomain: "game-overlay-e2d32.firebaseapp.com",
    databaseURL: "https://game-overlay-e2d32-default-rtdb.firebaseio.com",
    projectId: "game-overlay-e2d32",
    storageBucket: "game-overlay-e2d32.appspot.com",
    messagingSenderId: "583279550725",
    appId: "1:583279550725:web:e817fdf6cbd1a61813976c"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const overlayRef = ref(db, "overlay");

// Game logic variables
let wins = 0;
let losses = 0;
let points = 0;
let isInLegend = false;
let sessionGainLoss = 0;
const matchHistory = [];

const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Masters"];
const divisions = [4, 3, 2, 1];

// Load state from Firebase
onValue(overlayRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        wins = data.wins || 0;
        losses = data.losses || 0;
        points = data.points || 0;
        isInLegend = data.isInLegend || false;
        sessionGainLoss = data.sessionGainLoss || 0;
        matchHistory.length = 0;
        if (data.matchHistory) matchHistory.push(...data.matchHistory);
        updateOverlay();
        updateMatchHistory();
    }
});

// Save current state to Firebase
function saveState() {
    set(overlayRef, {
        wins,
        losses,
        points,
        isInLegend,
        sessionGainLoss,
        matchHistory
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    const winsElement = document.getElementById('wins');
    const lossesElement = document.getElementById('losses');

    if (!document.getElementById('wins-losses')) {
        const container = document.createElement('div');
        container.id = 'wins-losses';
        if (winsElement && lossesElement) {
            const winsParent = winsElement.parentNode;
            winsParent.insertBefore(container, winsElement);
            container.appendChild(winsElement);
            container.appendChild(lossesElement);
        }
    }

    updateOverlay();
    updateMatchHistory();
});

function getRank(rp) {
    if (isInLegend) return `Legend ${rp - 7600} RP`;
    if (rp >= 6400) return `Grandmasters ${rp - 6400} RP`;

    let tierIndex = Math.floor(rp / 800);
    if (tierIndex >= tiers.length) tierIndex = tiers.length - 1;
    const tier = tiers[tierIndex];

    const tierStartRP = tierIndex * 800;
    const intoTierRP = rp - tierStartRP;

    const divisionIndex = Math.floor(intoTierRP / 200);
    const division = divisions[divisionIndex] || 1;

    const divisionRP = intoTierRP % 200;

    return `${tier} ${division} ${divisionRP} RP`;
}

function addMatch(amount, type) {
    if (matchHistory.length >= 10) matchHistory.shift();
    matchHistory.push({ amount, type });
    updateMatchHistory();
}

function updateMatchHistory() {
    const container = document.getElementById("match-bubbles");
    container.innerHTML = "";
    for (let i = matchHistory.length - 1; i >= 0; i--) {
        const match = matchHistory[i];
        const bubble = document.createElement("div");
        bubble.className = `bubble ${match.type}`;
        bubble.textContent = Math.abs(match.amount);
        container.appendChild(bubble);
    }
}

function change(delta) {
    if (isNaN(delta)) return;
    if (delta > 0) {
        wins++;
        addMatch(delta, "win");
    } else if (delta < 0) {
        losses++;
        addMatch(delta, "loss");
    }
    points = Math.max(0, points + delta);
    sessionGainLoss += delta;
    updateOverlay();
    saveState();
}

function setRP(rp) {
    if (!isNaN(rp) && rp >= 0) {
        sessionGainLoss = 0;
        points = rp;
        updateOverlay();
        saveState();
    }
}

function resetStats() {
    wins = 0;
    losses = 0;
    points = 0;
    isInLegend = false;
    sessionGainLoss = 0;
    matchHistory.length = 0;
    updateOverlay();
    updateMatchHistory();
    saveState();
}

function isLegend() {
    isInLegend = !isInLegend;
    updateOverlay();
    saveState();
}

function updateOverlay() {
    document.getElementById("wins").textContent = `Wins: ${wins}`;
    document.getElementById("losses").textContent = `Losses: ${losses}`;

    const rankText = getRank(points);
    const rankInfo = document.getElementById("rank-info");
    rankInfo.textContent = rankText;

    const sessionElement = document.getElementById("session-gain-loss");
    sessionElement.textContent = `Session: ${sessionGainLoss > 0 ? '+' : ''}${sessionGainLoss} RP`;

    if (sessionGainLoss > 0) {
        sessionElement.style.color = 'var(--win-color)';
    } else if (sessionGainLoss < 0) {
        sessionElement.style.color = 'var(--loss-color)';
    } else {
        sessionElement.style.color = 'var(--text-primary)';
    }

    updateRankStyling(rankText);
}

function updateRankStyling(rankText) {
    const rankInfo = document.getElementById("rank-info");
    rankInfo.classList.remove(
        "rank-bronze", "rank-silver", "rank-gold", "rank-platinum",
        "rank-diamond", "rank-masters", "rank-grandmasters", "rank-legend"
    );

    if (rankText.includes("Legend")) {
        rankInfo.classList.add("rank-legend");
    } else if (rankText.includes("Grandmasters")) {
        rankInfo.classList.add("rank-grandmasters");
    } else if (rankText.includes("Masters")) {
        rankInfo.classList.add("rank-masters");
    } else if (rankText.includes("Diamond")) {
        rankInfo.classList.add("rank-diamond");
    } else if (rankText.includes("Platinum")) {
        rankInfo.classList.add("rank-platinum");
    } else if (rankText.includes("Gold")) {
        rankInfo.classList.add("rank-gold");
    } else if (rankText.includes("Silver")) {
        rankInfo.classList.add("rank-silver");
    } else {
        rankInfo.classList.add("rank-bronze");
    }
}

// Make controls available in console
window.change = change;
window.setRP = setRP;
window.resetStats = resetStats;
window.isLegend = isLegend;
