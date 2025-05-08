// Firebase Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDm1Qj95CzbgDyndTVKYGM5KqIerEkuD0w",
    authDomain: "game-overlay-e2d32.firebaseapp.com",
    databaseURL: "https://game-overlay-e2d32-default-rtdb.firebaseio.com",
    projectId: "game-overlay-e2d32",
    storageBucket: "game-overlay-e2d32.firebasestorage.app",
    messagingSenderId: "583279550725",
    appId: "1:583279550725:web:e817fdf6cbd1a61813976c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game logic variables
let wins = 0;
let losses = 0;
let points = 0;
let isInLegend = false;
let sessionGainLoss = 0;
const matchHistory = [];

const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Masters"];
const divisions = [4, 3, 2, 1];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Group wins and losses in a container for layout
    const winsElement = document.getElementById('wins');
    const lossesElement = document.getElementById('losses');

    // Create container if it doesn't exist
    if (!document.getElementById('wins-losses')) {
        const container = document.createElement('div');
        container.id = 'wins-losses';

        // Move wins and losses into this container
        if (winsElement && lossesElement) {
            const winsParent = winsElement.parentNode;
            winsParent.insertBefore(container, winsElement);
            container.appendChild(winsElement);
            container.appendChild(lossesElement);
        }
    }

    // Setup real-time data listener instead of one-time load
    setupRealtimeListener();
});

// Setup real-time database listener
function setupRealtimeListener() {
    const statsRef = ref(db, 'gameStats/');

    // This will trigger whenever data changes in Firebase
    onValue(statsRef, (snapshot) => {
        if (snapshot.exists()) {
            const stats = snapshot.val();
            // Update local variables
            wins = stats.wins || 0;
            losses = stats.losses || 0;
            points = stats.points || 0;
            isInLegend = stats.isInLegend || false;
            sessionGainLoss = stats.sessionGainLoss || 0;

            // Update match history
            matchHistory.length = 0;
            if (Array.isArray(stats.matchHistory)) {
                matchHistory.push(...stats.matchHistory);
            }

            // Update UI
            updateOverlay();
            updateMatchHistory();
        } else {
            console.log("No data available, initializing with defaults");
            resetStats(); // Initialize with default values if no data exists
        }
    }, (error) => {
        console.error("Error setting up real-time listener: ", error);
    });
}

function getRank(rp) {
    // Handle Legend rank
    if (isInLegend) return `Legend ${rp - 4800} RP`;
    if (rp >= 4800) return `Grandmasters ${rp - 4800} RP`;

    // Calculate which tier and division the RP falls into
    let tierIndex = Math.floor(rp / 800);
    if (tierIndex >= tiers.length) tierIndex = tiers.length - 1;
    const tier = tiers[tierIndex];

    // Calculate the RP within the tier and division
    const tierStartRP = tierIndex * 800;
    const intoTierRP = rp - tierStartRP;

    // Get division based on RP within the tier
    const divisionIndex = Math.floor(intoTierRP / 200);
    const division = divisions[divisionIndex] || 1;

    // Calculate the RP into the division
    const divisionRP = intoTierRP % 200;

    return `${tier} ${division} ${divisionRP} RP`;
}

function addMatch(amount, type) {
    if (matchHistory.length >= 10) matchHistory.shift();
    matchHistory.push({ amount, type });
    saveStatsToFirebase(); // This will trigger updates across all instances
}

function updateMatchHistory() {
    const container = document.getElementById("match-bubbles");
    if (!container) return; // Guard against missing element

    container.innerHTML = "";

    // Display newest matches on the left (reversed)
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
    saveStatsToFirebase(); // This will trigger updates across all instances
}

function setRP(rp) {
    if (!isNaN(rp) && rp >= 0) {
        sessionGainLoss = 0;
        points = rp;
        saveStatsToFirebase(); // This will trigger updates across all instances
    }
}

function resetStats() {
    wins = 0;
    losses = 0;
    points = 0;
    isInLegend = false;
    sessionGainLoss = 0;
    matchHistory.length = 0;
    saveStatsToFirebase(); // This will trigger updates across all instances
}

function isLegend() {
    isInLegend = !isInLegend;
    saveStatsToFirebase(); // This will trigger updates across all instances
}

function updateOverlay() {
    const winsElement = document.getElementById("wins");
    const lossesElement = document.getElementById("losses");
    const rankInfo = document.getElementById("rank-info");
    const sessionElement = document.getElementById("session-gain-loss");

    // Guard against missing elements
    if (!winsElement || !lossesElement || !rankInfo || !sessionElement) return;

    winsElement.textContent = `Wins: ${wins}`;
    lossesElement.textContent = `Losses: ${losses}`;

    const rankText = getRank(points);
    rankInfo.textContent = rankText;

    // Update the session gain/loss display
    sessionElement.textContent = `Session: ${sessionGainLoss > 0 ? '+' : ''}${sessionGainLoss} RP`;

    // Apply simple color styling based on session gain/loss
    if (sessionGainLoss > 0) {
        sessionElement.style.color = 'var(--win-color)';
    } else if (sessionGainLoss < 0) {
        sessionElement.style.color = 'var(--loss-color)';
    } else {
        sessionElement.style.color = 'var(--text-primary)';
    }

    // Apply rank-specific styling (just color)
    updateRankStyling(rankText);
}

function updateRankStyling(rankText) {
    const rankInfo = document.getElementById("rank-info");
    if (!rankInfo) return; // Guard against missing element

    // Remove all existing rank classes
    rankInfo.classList.remove(
        "rank-bronze", "rank-silver", "rank-gold", "rank-platinum",
        "rank-diamond", "rank-masters", "rank-grandmasters", "rank-legend"
    );

    // Apply appropriate rank class (color only)
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

// Firebase Functions
function saveStatsToFirebase() {
    const statsRef = ref(db, 'gameStats/');
    set(statsRef, {
        wins,
        losses,
        points,
        isInLegend,
        sessionGainLoss,
        matchHistory
    }).catch(error => {
        console.error("Error saving data: ", error);
    });
    // No need to update UI here as the onValue listener will handle that
}

// Expose functions to the global scope for external control
(function(global) {
    global.change = change;
    global.setRP = setRP;
    global.resetStats = resetStats;
    global.isLegend = isLegend;
})(typeof window !== 'undefined' ? window : global);

console.log("Use change(x), setRP(x), resetStats(), isLegend() from the console. Positive x = win, negative x = loss.");