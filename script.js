// ===================================
// CHESS TRAINING ASSISTANT
// ===================================

const $ = id => document.getElementById(id);

const read = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
};

const save = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

let matches = read("cta_matches", []);
let profile = read("cta_profile", {});
let solvedIds = read("cta_solved", []);
let puzzleScore = Number(localStorage.getItem("cta_puzzle_score") || 0);


// ===================================
// NAVIGASI
// ===================================

function showPage(id) {
    document.querySelectorAll(".page").forEach(p => {
        p.classList.toggle("active", p.id === id);
    });

    document.querySelectorAll(".navbtn").forEach(b => {
        b.classList.toggle("active", b.dataset.page === id);
    });

    if (id === "analysis" || id === "home") updateStats();
    if (id === "profile") renderProfile();
    if (id === "matches") renderMatches();
}

document.querySelectorAll(".navbtn").forEach(b => {
    b.addEventListener("click", () => showPage(b.dataset.page));
});


// ===================================
// PLAYER PROFILE
// ===================================

function saveProfile() {
    profile = {
        name: $("playerName").value.trim(),
        rating: $("playerRating").value,
        goal: $("playerGoal").value
    };

    if (!profile.name) {
        $("profileMessage").textContent =
            "Isi nama pemain terlebih dahulu.";
        return;
    }

    save("cta_profile", profile);

    $("profileMessage").textContent =
        "Profil berhasil disimpan.";

    renderProfile();
    updateStats();
}

function renderProfile() {
    $("playerName").value = profile.name || "";
    $("playerRating").value = profile.rating || "";
    $("playerGoal").value = profile.goal || "Latihan rutin";

    $("profileSummary").textContent = profile.name
        ? `${profile.name} • Rating: ${profile.rating || "Belum diisi"} • Target: ${profile.goal || "Latihan rutin"}`
        : "Belum ada profil yang disimpan.";
}


// ===================================
// MATCH TRACKER
// ===================================

function addMatch() {
    const opponent = $("opponent").value.trim();
    const date = $("matchDate").value;
    const result = $("matchResult").value;
    const color = $("matchColor").value;
    const notes = $("matchNotes").value.trim();

    if (!opponent || !date) {
        alert("Isi nama lawan dan tanggal pertandingan.");
        return;
    }

    matches.unshift({
        id: Date.now(),
        opponent,
        date,
        result,
        color,
        notes
    });

    save("cta_matches", matches);

    $("opponent").value = "";
    $("matchNotes").value = "";

    renderMatches();
    updateStats();
}

function deleteMatch(id) {
    matches = matches.filter(m => m.id !== id);

    save("cta_matches", matches);

    renderMatches();
    updateStats();
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function renderMatches() {
    $("matchRows").innerHTML = matches.map(m => `
        <tr>
            <td>${escapeHTML(m.date)}</td>
            <td>${escapeHTML(m.opponent)}</td>
            <td>${escapeHTML(m.result)}</td>
            <td>${escapeHTML(m.color)}</td>
            <td>${escapeHTML(m.notes || "-")}</td>
            <td>
                <button class="danger" onclick="deleteMatch(${m.id})">
                    Hapus
                </button>
            </td>
        </tr>
    `).join("");

    $("emptyMatches").classList.toggle(
        "hidden",
        matches.length > 0
    );
}


// ===================================
// PERFORMANCE ANALYSIS
// ===================================

function updateStats() {
    const w = matches.filter(m => m.result === "Menang").length;
    const d = matches.filter(m => m.result === "Seri").length;
    const l = matches.filter(m => m.result === "Kalah").length;

    const n = matches.length;
    const rate = n ? Math.round(w / n * 100) : 0;

    $("homeGames").textContent = n;
    $("homeWins").textContent = w;
    $("homePuzzle").textContent = solvedIds.length;
    $("homeRate").textContent = rate + "%";

    $("analysisGames").textContent = n;
    $("analysisWins").textContent = w;
    $("analysisDraws").textContent = d;
    $("analysisLosses").textContent = l;
    $("analysisWinRate").textContent = rate + "%";
    $("analysisSolved").textContent = solvedIds.length;

    $("puzzleScore").textContent = puzzleScore;

    $("analysisAdvice").textContent =
        n === 0
        ? "Belum ada data pertandingan. Mulai catat pertandinganmu di menu Match Tracker."
        : rate >= 60
        ? "Hasil pertandinganmu cukup positif. Pertahankan latihan dan evaluasi setiap kekalahan."
        : rate >= 35
        ? "Perkembanganmu bisa ditingkatkan. Coba evaluasi kesalahan dan rutin mengerjakan puzzle taktik."
        : "Jadikan setiap pertandingan sebagai bahan belajar. Fokus pada keamanan raja, pengembangan bidak, dan evaluasi langkah.";
}


// ===================================
// EXPORT DATA
// ===================================

function exportData() {
    const data = {
        profile,
        matches,
        solvedPuzzles: solvedIds,
        puzzleScore
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "chess-training-data.json";
    a.click();

    URL.revokeObjectURL(url);
}


// ===================================
// CHESS PUZZLE
// ===================================

const API = "https://chess.mauriulloa.com/v1/puzzles";

let puzzleList = [];
let puzzleIndex = 0;
let currentPuzzle = null;
let game = null;
let solution = [];
let solutionIndex = 0;
let selected = null;
let puzzleSolved = false;
let puzzleBusy = false;

const symbols = {
    wp: "♙", wn: "♘", wb: "♗",
    wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝",
    br: "♜", bq: "♛", bk: "♚"
};

function uciToMove(uci) {
    return {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q"
    };
}

function colorName(c) {
    return c === "w" ? "Putih" : "Hitam";
}


// MEMUAT PUZZLE

async function loadPuzzleSet() {
    if (typeof Chess === "undefined") {
        $("puzzleStatus").textContent =
            "Library catur belum termuat. Periksa koneksi internet.";
        return;
    }

    if (puzzleBusy) return;

    puzzleBusy = true;
    $("loadPuzzlesBtn").disabled = true;
    $("puzzleStatus").textContent = "Sedang mengambil puzzle...";

    const level = $("puzzleLevel").value;
    const count = Number($("puzzleCount").value);

    const ranges = {
        beginner: [800, 1399],
        intermediate: [1400, 1799],
        advanced: [1800, 2199]
    };

    const [min, max] = ranges[level];

    try {
        const res = await fetch(
            `${API}/random?ratingMin=${min}&ratingMax=${max}&count=${count}`
        );

        if (!res.ok) {
            throw new Error(`Server memberi respons ${res.status}.`);
        }

        const data = await res.json();

        puzzleList = Array.isArray(data)
            ? data
            : data.puzzles || data.items || data.results || data.data || [];

        if (!Array.isArray(puzzleList) || !puzzleList.length) {
            throw new Error("Data puzzle kosong atau format server berubah.");
        }

        puzzleIndex = 0;
        await loadCurrentPuzzle();

    } catch (e) {
        $("puzzleStatus").textContent =
            "Gagal memuat puzzle: " + e.message;

    } finally {
        puzzleBusy = false;
        $("loadPuzzlesBtn").disabled = false;
    }
}


// MEMBUKA PUZZLE

async function loadCurrentPuzzle() {
    currentPuzzle = puzzleList[puzzleIndex];

    solution = [];
    solutionIndex = 0;
    selected = null;
    puzzleSolved = false;

    $("puzzleHint").textContent = "";
    $("puzzleResult").textContent = "";
    $("puzzleRating").textContent = currentPuzzle.rating ?? "-";

    $("puzzleNumber").textContent =
        `${puzzleIndex + 1} / ${puzzleList.length}`;

    $("puzzleStatus").textContent = "Menyiapkan posisi...";

    try {
        const res = await fetch(
            `${API}/${encodeURIComponent(currentPuzzle.id)}/solution`
        );

        if (!res.ok) {
            throw new Error("Solusi puzzle tidak dapat diambil.");
        }

        const sol = await res.json();
        solution = sol.solution || sol.moves || [];

        if (!solution.length) {
            throw new Error("Solusi puzzle tidak tersedia.");
        }

        let fen = currentPuzzle.positionFen;

        if (!fen && currentPuzzle.fen && currentPuzzle.initialMove) {
            const temp = new Chess(currentPuzzle.fen);
            const mv = uciToMove(currentPuzzle.initialMove);
            temp.move(mv);
            fen = temp.fen();
        }

        if (!fen) {
            throw new Error("Posisi papan tidak ditemukan.");
        }

        game = new Chess(fen);

        $("puzzleTurn").textContent =
            `Giliran kamu: ${colorName(currentPuzzle.solverColor || game.turn())}`;

        $("puzzleStatus").textContent =
            "Temukan langkah terbaik!";

        renderBoard();

    } catch (e) {
        $("puzzleStatus").textContent =
            "Puzzle gagal dibuka: " + e.message;
    }
}


// MENAMPILKAN PAPAN CATUR

function renderBoard() {
    if (!game) return;

    const board = $("puzzleBoard");
    board.innerHTML = "";

    const orientation =
        (currentPuzzle?.solverColor || "w") === "b"
        ? "black"
        : "white";

    const files = orientation === "white"
        ? ["a","b","c","d","e","f","g","h"]
        : ["h","g","f","e","d","c","b","a"];

    const ranks = orientation === "white"
        ? [8,7,6,5,4,3,2,1]
        : [1,2,3,4,5,6,7,8];

    let targets = [];

    if (selected) {
        targets = game.moves({
            square: selected,
            verbose: true
        }).map(m => m.to);
    }

    ranks.forEach((rank, ri) => {
        files.forEach((file, fi) => {
            const sq = file + rank;
            const piece = game.get(sq);

            const el = document.createElement("div");

            el.className =
                "square " + ((ri + fi) % 2 === 0 ? "light" : "dark");

            if (sq === selected) {
                el.classList.add("selected");
            }

            if (targets.includes(sq)) {
                el.classList.add("target");
            }

            if (piece) {
                el.textContent = symbols[piece.color + piece.type];
            }

            el.addEventListener("click", () => onSquareClick(sq));

            board.appendChild(el);
        });
    });
}


// MEMILIH DAN MENGGERAKKAN BIDAK

function onSquareClick(sq) {
    if (!game || puzzleSolved || puzzleBusy) return;

    const piece = game.get(sq);
    const turn = game.turn();

    if (selected) {
        const legal = game.moves({
            square: selected,
            verbose: true
        }).find(m => m.to === sq);

        if (legal) {
            const expected = solution[solutionIndex];
            const actual = selected + sq + (legal.promotion || "");

            const expectedMove = expected
                ? uciToMove(expected)
                : null;

            if (
                !expectedMove ||
                expectedMove.from !== selected ||
                expectedMove.to !== sq ||
                (expectedMove.promotion || "q") !== (legal.promotion || "q")
            ) {
                $("puzzleStatus").textContent =
                    "Belum tepat. Coba langkah lain atau gunakan Hint.";

                selected = null;
                renderBoard();
                return;
            }

            playSolutionMove(expected);
            return;
        }
    }

    if (piece && piece.color === turn) {
        selected = sq;
        renderBoard();
    } else {
        selected = null;
        renderBoard();
    }
}


// MENJALANKAN LANGKAH SOLUSI

function playSolutionMove(uci) {
    const mv = uciToMove(uci);

    try {
        game.move(mv);
    } catch (e) {
        $("puzzleStatus").textContent =
            "Langkah tidak dapat dijalankan.";
        return;
    }

    solutionIndex++;
    selected = null;
    renderBoard();

    if (solutionIndex >= solution.length) {
        completePuzzle();
        return;
    }

    $("puzzleStatus").textContent =
        "Langkah benar! Lawan sedang merespons...";

    setTimeout(() => {
        if (!game || puzzleSolved) return;

        const reply = uciToMove(solution[solutionIndex]);

        try {
            game.move(reply);
            solutionIndex++;

            renderBoard();

            $("puzzleStatus").textContent =
                "Sekarang giliranmu lagi.";

            if (solutionIndex >= solution.length) {
                completePuzzle();
            }

        } catch (e) {
            $("puzzleStatus").textContent =
                "Balasan puzzle tidak dapat dijalankan.";
        }

    }, 650);
}


// PUZZLE SELESAI

function completePuzzle() {
    puzzleSolved = true;

    $("puzzleStatus").textContent =
        "Hebat! Puzzle berhasil diselesaikan.";

    $("puzzleResult").textContent =
        "✓ Benar! Kamu mendapatkan 10 poin.";

    if (
        currentPuzzle?.id &&
        !solvedIds.includes(currentPuzzle.id)
    ) {
        solvedIds.push(currentPuzzle.id);
        puzzleScore += 10;

        save("cta_solved", solvedIds);

        localStorage.setItem(
            "cta_puzzle_score",
            puzzleScore
        );
    }

    updateStats();
}


// PETUNJUK PUZZLE

function showPuzzleHint() {
    if (!currentPuzzle) {
        $("puzzleHint").textContent =
            "Muat puzzle terlebih dahulu.";
        return;
    }

    const themes = (currentPuzzle.themes || [])
        .join(" ")
        .toLowerCase();

    let hint =
        "Perhatikan apakah ada bidak lawan yang tidak terlindungi atau raja yang memiliki ancaman.";

    if (themes.includes("fork")) {
        hint = "Petunjuk: cari langkah yang menyerang dua bidak lawan sekaligus.";
    } else if (themes.includes("pin")) {
        hint = "Petunjuk: cari bidak yang terikat karena bergerak akan membuka serangan ke bidak penting.";
    } else if (themes.includes("skewer")) {
        hint = "Petunjuk: cari serangan pada bidak bernilai tinggi yang memaksa bidak di belakangnya berpindah.";
    } else if (themes.includes("mate")) {
        hint = "Petunjuk: periksa kemungkinan skakmat dan jalur kabur raja lawan.";
    } else if (themes.includes("sacrifice")) {
        hint = "Petunjuk: pertimbangkan pengorbanan bidak untuk memperoleh keuntungan taktis.";
    }

    $("puzzleHint").textContent = hint;
}


// MENGULANGI PUZZLE

function restartCurrentPuzzle() {
    if (!currentPuzzle) return;
    loadCurrentPuzzle();
}


// PUZZLE BERIKUTNYA

function nextPuzzle() {
    if (!puzzleList.length) {
        $("puzzleStatus").textContent =
            "Muat puzzle terlebih dahulu.";
        return;
    }

    if (puzzleIndex >= puzzleList.length - 1) {
        $("puzzleStatus").textContent =
            "Semua puzzle dalam sesi ini sudah dilewati. Muat sesi baru untuk puzzle lainnya.";
        return;
    }

    puzzleIndex++;
    loadCurrentPuzzle();
}


// ===================================
// INISIALISASI APLIKASI
// ===================================

$("matchDate").value = new Date().toISOString().slice(0, 10);

renderProfile();
renderMatches();
updateStats();
