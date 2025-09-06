// Minimal flashcards app powered by client-side XLSX parsing

const fileInput = document.getElementById('fileInput');
const filePickerBtn = document.getElementById('filePickerBtn');
const selectedFileEl = document.getElementById('selectedFile');
const settingsPanel = document.getElementById('settingsPanel');
const sheetsPanel = document.getElementById('sheetsPanel');
const sheetSelect = document.getElementById('sheetSelect');
const questionCol = document.getElementById('questionCol');
const answerCol = document.getElementById('answerCol');
const startRowInput = document.getElementById('startRow');
const endRowInput = document.getElementById('endRow');
const shuffleCheckbox = document.getElementById('shuffle');
const startBtn = document.getElementById('startBtn');

const flashcardSection = document.getElementById('flashcardSection');
const flipContainer = document.getElementById('flashcard');
const flipInner = document.getElementById('flipInner');
const questionEl = document.getElementById('flashcardQuestion');
const answerEl = document.getElementById('flashcardAnswer');
const showAnswerBtn = document.getElementById('showAnswerBtn');
const prevBtn = document.getElementById('prevBtn');
const restartBtn = document.getElementById('restartBtn');
const settingsBtn = document.getElementById('settingsBtn');
const studyPrompt = document.getElementById('studyPrompt');
const confidenceRating = document.getElementById('confidenceRating');
const floatingControls = document.getElementById('floatingControls');
const floatingSettingsBtn = document.getElementById('floatingSettingsBtn');
const floatingStatsBtn = document.getElementById('floatingStatsBtn');
const floatingHelpBtn = document.getElementById('floatingHelpBtn');
const celebrationScreen = document.getElementById('celebrationScreen');
const celebrateRestartBtn = document.getElementById('celebrateRestartBtn');
const celebrateNewDeckBtn = document.getElementById('celebrateNewDeckBtn');

/** State */
let currentWorkbook = null; // { name, wb, sheets: [name] }
let allCards = []; // All cards with mastery data
let studyQueue = []; // Cards that need to be studied
let currentIndex = 0;
let showingAnswer = false;
let sessionStats = { mastered: 0, learning: 0, new: 0 };
let studyStartTime = null;

/** Helpers */
function toColumnLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildOptions(selectEl, values) {
  selectEl.innerHTML = '';
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v.value;
    opt.textContent = v.label;
    selectEl.appendChild(opt);
  }
}

function updateSessionStats() {
  sessionStats.mastered = allCards.filter(card => card.mastery === 2).length;
  sessionStats.learning = allCards.filter(card => card.mastery === 1).length;
  sessionStats.new = allCards.filter(card => card.mastery === 0).length;
  
  // Update mastery indicators if they exist
  const masteryEl = document.getElementById('masteryStats');
  if (masteryEl) {
    masteryEl.innerHTML = `
      <div class="mastery-item mastered">${sessionStats.mastered} mastered</div>
      <div class="mastery-item learning">${sessionStats.learning} learning</div>
      <div class="mastery-item new">${sessionStats.new} to learn</div>
    `;
  }
}

function buildStudyQueue() {
  // Study queue = new cards + learning cards (immediately, not waiting for review interval)
  studyQueue = allCards.filter(card => 
    card.mastery === 0 || // New cards
    card.mastery === 1    // Learning cards (immediately available for review)
  );
  
  // Shuffle the queue
  if (studyQueue.length > 0) {
    shuffleArray(studyQueue);
  }
  currentIndex = 0;
  updateSessionStats();
}

function shouldReviewCard(card) {
  if (!card.lastReviewed) return true;
  const now = Date.now();
  const timeSinceReview = now - card.lastReviewed;
  const reviewInterval = 24 * 60 * 60 * 1000; // 24 hours for learning cards
  return timeSinceReview >= reviewInterval;
}

function rateConfidence(rating) {
  if (studyQueue.length === 0 || currentIndex >= studyQueue.length) return;
  
  const card = studyQueue[currentIndex];
  const now = Date.now();
  
  // Update card based on confidence rating - clear 0-1-2 system
  switch(rating) {
    case 'easy':
      card.mastery = 2; // Mastered
      card.confidence = 'easy';
      break;
    case 'medium':
      card.mastery = 1; // Learning
      card.confidence = 'medium';
      break;
    case 'hard':
      card.mastery = 0; // To learn
      card.confidence = 'hard';
      break;
  }
  
  card.lastReviewed = now;
  card.reviewCount = (card.reviewCount || 0) + 1;
  
  // Move to next card in queue
  currentIndex++;
  
  // Check if we've completed the study queue
  if (currentIndex >= studyQueue.length) {
    // Rebuild queue for next round
    buildStudyQueue();
    if (studyQueue.length === 0) {
      // All cards mastered!
      showCompletionMessage();
      return;
    }
  }
  
  showingAnswer = false;
  renderCard();
  updateSessionStats();
}

function renderCard() {
  if (studyQueue.length === 0 || currentIndex >= studyQueue.length) {
    questionEl.textContent = 'No cards to study!';
    answerEl.textContent = '';
    if (flipInner) flipInner.classList.remove('flipped');
    if (confidenceRating) confidenceRating.classList.add('hidden');
    return;
  }
  
  const item = studyQueue[currentIndex];
  questionEl.textContent = item.q ?? '';
  answerEl.textContent = item.a ?? '';
  if (flipInner) flipInner.classList.toggle('flipped', showingAnswer);
  showAnswerBtn.textContent = showingAnswer ? 'Show question ✨' : 'Show answer ✨';
  
  // Show confidence rating only when answer is shown
  if (confidenceRating) {
    confidenceRating.classList.toggle('hidden', !showingAnswer);
  }
  
}

function showCompletionMessage() {
  const studyTime = studyStartTime ? Math.round((Date.now() - studyStartTime) / 60000) : 0;
  
  // Update celebration screen stats
  document.getElementById('totalCardsCount').textContent = allCards.length;
  document.getElementById('masteredCount').textContent = sessionStats.mastered;
  document.getElementById('studyTime').textContent = studyTime;
  
  // Hide flashcard section and show celebration
  flashcardSection.classList.add('hidden');
  celebrationScreen.classList.remove('hidden');
}

function resetUI() {
  if (showAnswerBtn) showAnswerBtn.style.display = '';
}

function resetAllMastery() {
  allCards.forEach(card => {
    card.mastery = 0;
    card.confidence = 'new';
    card.lastReviewed = null;
    card.reviewCount = 0;
  });
}

function prevCard() {
  if (studyQueue.length === 0) return;
  currentIndex = (currentIndex - 1 + studyQueue.length) % studyQueue.length;
  showingAnswer = false;
  renderCard();
  if (flipInner) {
    flipInner.classList.remove('bump');
    void flipInner.offsetWidth;
    flipInner.classList.add('bump');
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** XLSX handling */

// File picker events
filePickerBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles());

async function handleFiles() {
  const files = Array.from(fileInput.files || []);
  if (files.length === 0) return;
  const file = files[0];
  
  // Show loading state
  selectedFileEl.textContent = `Loading ${file.name}...`;
  selectedFileEl.className = 'hint loading';
  
  // Hide the file picker after file is loaded
  const filePicker = document.querySelector('.file-picker');
  if (filePicker) filePicker.style.display = 'none';
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetNames = wb.SheetNames;
    currentWorkbook = { name: file.name, wb, sheets: sheetNames };
    
    // Show loaded state
    selectedFileEl.textContent = `Loaded: ${file.name}`;
    selectedFileEl.className = 'hint success';
    
    buildOptions(sheetSelect, sheetNames.map((n, idx) => ({ value: String(idx), label: n })));
    sheetSelect.selectedIndex = 0;
    initColumnsAndRange();
    sheetsPanel.classList.remove('hidden');
  } catch (error) {
    // Show error state
    selectedFileEl.textContent = `Error loading ${file.name}`;
    selectedFileEl.className = 'hint error';
    console.error('Error loading file:', error);
  }
}

function initColumnsAndRange() {
  if (!currentWorkbook) return;
  const sheetName = currentWorkbook.sheets[Number(sheetSelect.value) || 0];
  const ws = currentWorkbook.wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const numCols = range.e.c - range.s.c + 1;
  const numRows = range.e.r - range.s.r + 1;

  // Build options using header names from the first row via AoA for robustness
  let headerRowValues = [];
  let allData = [];
  try {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    headerRowValues = Array.isArray(aoa) && aoa.length > 0 ? aoa[0] : [];
    allData = aoa || [];
  } catch (_) {
    headerRowValues = [];
    allData = [];
  }

  // Helper function to check if a column has any data
  function hasColumnData(colIndex) {
    // Check if any row in this column has non-empty data
    for (let rowIndex = 0; rowIndex < allData.length; rowIndex++) {
      const cellValue = allData[rowIndex] && allData[rowIndex][colIndex];
      if (cellValue != null && String(cellValue).trim() !== '') {
        return true;
      }
    }
    return false;
  }

  // Build column options, filtering out empty columns
  const columnOptions = [];
  for (let i = 0; i < numCols; i++) {
    // Only include columns that have data
    if (hasColumnData(i)) {
      const colNumber = i + 1; // 1-based
      const headerText = headerRowValues[i] != null ? String(headerRowValues[i]).trim() : '';
      const label = headerText !== '' ? headerText : `(${toColumnLetter(colNumber)})`;
      columnOptions.push({ value: String(colNumber), label });
    }
  }

  buildOptions(questionCol, columnOptions);
  buildOptions(answerCol, columnOptions);
  questionCol.selectedIndex = 0;
  answerCol.selectedIndex = Math.min(1, columnOptions.length - 1);
  
  // Update answer column when question column changes
  updateAnswerColumnOptions();

  // Rows are 1-based for user; skip header row by default if it looks like header
  const defaultStart = 2; // assume first row is header
  startRowInput.min = '2'; // Minimum is 2 to avoid header row
  startRowInput.max = String(numRows);
  startRowInput.value = String(Math.min(Math.max(2, defaultStart), numRows));
  endRowInput.min = '2'; // Minimum is 2 to avoid header row
  endRowInput.max = String(numRows);
  endRowInput.value = String(numRows);
  
  // Add validation event listeners
  startRowInput.addEventListener('input', validateRowRange);
  endRowInput.addEventListener('input', validateRowRange);
}

sheetSelect.addEventListener('change', initColumnsAndRange);

function updateAnswerColumnOptions() {
  if (!currentWorkbook) return;
  
  const sheetName = currentWorkbook.sheets[Number(sheetSelect.value) || 0];
  const ws = currentWorkbook.wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  const numCols = range.e.c - range.s.c + 1;
  const selectedQuestionCol = Number(questionCol.value);
  
  // Build all column options
  let headerRowValues = [];
  let allData = [];
  try {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    headerRowValues = Array.isArray(aoa) && aoa.length > 0 ? aoa[0] : [];
    allData = aoa || [];
  } catch (_) {
    headerRowValues = [];
    allData = [];
  }

  // Helper function to check if a column has any data
  function hasColumnData(colIndex) {
    // Check if any row in this column has non-empty data
    for (let rowIndex = 0; rowIndex < allData.length; rowIndex++) {
      const cellValue = allData[rowIndex] && allData[rowIndex][colIndex];
      if (cellValue != null && String(cellValue).trim() !== '') {
        return true;
      }
    }
    return false;
  }
  
  // Build column options, filtering out empty columns
  const allColumnOptions = [];
  for (let i = 0; i < numCols; i++) {
    // Only include columns that have data
    if (hasColumnData(i)) {
      const colNumber = i + 1;
      const headerText = headerRowValues[i] != null ? String(headerRowValues[i]).trim() : '';
      const label = headerText !== '' ? headerText : `(${toColumnLetter(colNumber)})`;
      allColumnOptions.push({ value: String(colNumber), label });
    }
  }
  
  // Filter out the selected question column
  const answerColumnOptions = allColumnOptions.filter(option => 
    Number(option.value) !== selectedQuestionCol
  );
  
  // Update answer column options
  buildOptions(answerCol, answerColumnOptions);
  
  // If current answer selection is invalid, select the first available option
  if (answerColumnOptions.length > 0 && !answerColumnOptions.find(opt => opt.value === answerCol.value)) {
    answerCol.selectedIndex = 0;
  }
}

function validateRowRange() {
  const startRow = parseInt(startRowInput.value) || 2;
  const endRow = parseInt(endRowInput.value) || 2;
  const maxRows = parseInt(startRowInput.max) || 2;
  const minRows = 2; // Minimum is 2 to avoid header row
  
  // Validate start row
  if (startRow < minRows) {
    startRowInput.value = String(minRows);
    startRowInput.style.borderColor = 'var(--danger)';
  } else if (startRow > maxRows) {
    startRowInput.value = String(maxRows);
    startRowInput.style.borderColor = 'var(--danger)';
  } else {
    startRowInput.style.borderColor = 'var(--border)';
  }
  
  // Validate end row
  if (endRow < minRows) {
    endRowInput.value = String(minRows);
    endRowInput.style.borderColor = 'var(--danger)';
  } else if (endRow > maxRows) {
    endRowInput.value = String(maxRows);
    endRowInput.style.borderColor = 'var(--danger)';
  } else {
    endRowInput.style.borderColor = 'var(--border)';
  }
  
  // Ensure start row is not greater than end row
  const finalStartRow = parseInt(startRowInput.value);
  const finalEndRow = parseInt(endRowInput.value);
  
  if (finalStartRow > finalEndRow) {
    endRowInput.value = String(finalStartRow);
    endRowInput.style.borderColor = 'var(--danger)';
  }
  
  // Reset border color after a short delay
  setTimeout(() => {
    startRowInput.style.borderColor = 'var(--border)';
    endRowInput.style.borderColor = 'var(--border)';
  }, 1000);
}

// Event listeners
sheetSelect.addEventListener('change', initColumnsAndRange);
questionCol.addEventListener('change', updateAnswerColumnOptions);

startBtn.addEventListener('click', () => {
  if (!currentWorkbook) return;
  
  // Validate inputs before proceeding
  validateRowRange();
  
  const sheetName = currentWorkbook.sheets[Number(sheetSelect.value) || 0];
  const ws = currentWorkbook.wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const qColNum = Number(questionCol.value); // 1-based
  const aColNum = Number(answerCol.value);
  const startRow = Math.max(1, Number(startRowInput.value) || 1);
  const endRow = Math.max(startRow, Number(endRowInput.value) || startRow);
  
  // Additional validation
  if (startRow > endRow) {
    alert('Start row cannot be greater than end row!');
    return;
  }
  
  if (startRow < 2 || endRow < 2) {
    alert('Row numbers must be at least 2! (Row 1 contains headers)');
    return;
  }
  
  const maxRows = range.e.r - range.s.r + 1;
  if (startRow > maxRows || endRow > maxRows) {
    alert(`Row numbers cannot exceed ${maxRows} (total rows in sheet)!`);
    return;
  }

  const deck = [];
  for (let r = startRow; r <= endRow; r++) {
    const r0 = range.s.r + (r - 1); // convert to 0-based absolute row index
    const qCellAddr = XLSX.utils.encode_cell({ r: r0, c: range.s.c + (qColNum - 1) });
    const aCellAddr = XLSX.utils.encode_cell({ r: r0, c: range.s.c + (aColNum - 1) });
    const qCell = ws[qCellAddr];
    const aCell = ws[aCellAddr];
    const qVal = qCell ? String(qCell.v) : '';
    const aVal = aCell ? String(aCell.v) : '';
    if (qVal !== '' || aVal !== '') {
      deck.push({ 
        q: qVal, 
        a: aVal, 
        confidence: 'new',
        mastery: 0,
        lastReviewed: null,
        reviewCount: 0
      });
    }
  }

  if (shuffleCheckbox.checked) shuffleArray(deck);

  allCards = deck;
  buildStudyQueue();
  
  flashcardSection.classList.remove('hidden');
  floatingControls.classList.remove('hidden');
  studyStartTime = Date.now(); // Start tracking study time
  // Hide settings to focus on study
  if (settingsPanel) settingsPanel.classList.add('hidden');

  // Build study prompt from header titles if present
  try {
    const headerRowR = range.s.r;
    const qHeader = ws[XLSX.utils.encode_cell({ r: headerRowR, c: range.s.c + (qColNum - 1) })];
    const aHeader = ws[XLSX.utils.encode_cell({ r: headerRowR, c: range.s.c + (aColNum - 1) })];
    const qLabel = qHeader && qHeader.v ? String(qHeader.v).trim() : `Column ${toColumnLetter(qColNum)}`;
    const aLabel = aHeader && aHeader.v ? String(aHeader.v).trim() : `Column ${toColumnLetter(aColNum)}`;
    if (studyPrompt) studyPrompt.textContent = `What is the ${aLabel} of ${qLabel}?`;
  } catch (_) {
    if (studyPrompt) studyPrompt.textContent = '';
  }
  renderCard();
});

showAnswerBtn.addEventListener('click', () => {
  showingAnswer = !showingAnswer;
  renderCard();
});

// Also toggle by clicking the card itself
flipContainer.addEventListener('click', () => {
  showingAnswer = !showingAnswer;
  renderCard();
});

prevBtn.addEventListener('click', prevCard);
restartBtn.addEventListener('click', () => {
  resetUI();
  resetAllMastery();
  buildStudyQueue();
  showingAnswer = false;
  renderCard();
});

settingsBtn.addEventListener('click', () => {
  if (settingsPanel) {
    settingsPanel.classList.remove('hidden');
    // Hide flashcard section when showing settings
    flashcardSection.classList.add('hidden');
  }
});

// Floating controls
floatingSettingsBtn.addEventListener('click', () => {
  if (settingsPanel) {
    settingsPanel.classList.remove('hidden');
    // Hide flashcard section when showing settings
    flashcardSection.classList.add('hidden');
  }
});

floatingStatsBtn.addEventListener('click', () => {
  alert(`Study Stats:\n\n📚 Total Cards: ${allCards.length}\n✅ Mastered: ${sessionStats.mastered}\n🔄 Learning: ${sessionStats.learning}\n🆕 New: ${sessionStats.new}`);
});

floatingHelpBtn.addEventListener('click', () => {
  alert(`Study Tips:\n\n✨ Rate your confidence after each answer\n📊 Track your mastery progress\n⌨️ Use keyboard shortcuts for faster studying\n🔄 Review harder cards more frequently`);
});

celebrateNewDeckBtn.addEventListener('click', () => {
  celebrationScreen.classList.add('hidden');
  
  // Reset everything completely
  resetAllMastery();
  allCards = [];
  studyQueue = [];
  currentIndex = 0;
  showingAnswer = false;
  studyStartTime = null;
  currentWorkbook = null;
  
  // Reset UI elements
  resetUI();
  
  // Reset file picker and show it
  const filePicker = document.querySelector('.file-picker');
  if (filePicker) filePicker.style.display = '';
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
  const selectedFileEl = document.getElementById('selectedFile');
  if (selectedFileEl) {
    selectedFileEl.textContent = '';
    selectedFileEl.className = 'hint';
  }
  
  // Hide sheets panel and show settings
  const sheetsPanel = document.getElementById('sheetsPanel');
  if (sheetsPanel) sheetsPanel.classList.add('hidden');
  if (settingsPanel) settingsPanel.classList.remove('hidden');
  
  // Hide floating controls
  floatingControls.classList.add('hidden');
});

// Confidence rating button event listeners
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('confidence-btn')) {
    const rating = e.target.getAttribute('data-rating');
    if (rating) {
      rateConfidence(rating);
    }
  }
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (flashcardSection.classList.contains('hidden')) return;
  const handledKeys = ['ArrowLeft',' ','Enter','r','R'];
  if (!handledKeys.includes(e.key)) return;
  // Blur any focused control to avoid browser focus highlight triggering
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') {
    active.blur();
  }
  // Handle shortcuts and prevent default to stop native focus/click behavior
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevCard();
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    showingAnswer = !showingAnswer;
    renderCard();
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    resetUI();
    resetAllMastery();
    buildStudyQueue();
    showingAnswer = false;
    renderCard();
  }
});

window.addEventListener('DOMContentLoaded', () => {});


