// OTP
const inputs = document.querySelectorAll('.onyba-otp-input-box');

inputs.forEach((input, index) => {
    // Jab user input daalega
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Sirf 1 hi digit allow karega input box me
        if (value.length > 1) {
            e.target.value = value.slice(0, 1);
        }

        // Agar current box bhar gya hai, toh automatic agle box par focus move karega
        if (e.target.value !== "" && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Jab user Backspace press karega back aane ke liye
    input.addEventListener('keydown', (e) => {
        if (e.key === "Backspace") {
            // Agar box khali hai, toh focus pichle box par le jao aur uski value reset karo
            if (e.target.value === "" && index > 0) {
                inputs[index - 1].focus();
                inputs[index - 1].value = "";
            }
        }
    });
});


// OTP






/**
 * Scoped Dropdown UI Control Toggles
 * @param {string} id - Target DOM Element Dropdown Identification Key
 */
function toggleDropdown(id) {
  // Close all other instances to avoid overlay rendering conflicts
  document.querySelectorAll('.tp-dropdown-menu, .tp-dropdown-panel-box').forEach(el => {
    if (el.id !== id) el.classList.remove('show');
  });

  const targetMenu = document.getElementById(id);
  if (targetMenu) {
    targetMenu.classList.toggle('show');
  }
}

/**
 * Standard Document Selection Handler 
 * @param {string} documentType - Selected value string payload
 */
function selectDocument(documentType) {
  const displayLabel = document.getElementById('selectedDoc');
  if (displayLabel) {
    displayLabel.textContent = documentType;
  }

  // Set current active item styling rule mapping
  const items = document.querySelectorAll('#docDropdown .tp-dropdown-item');
  items.forEach(item => {
    if (item.textContent === documentType) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Close interface pane seamlessly
  document.getElementById('docDropdown').classList.remove('show');
}

// Intercept Global Window Context Clicks to Close Active Drops Outside Target
window.addEventListener('click', function (e) {
  if (!e.target.closest('.tp-custom-select-wrapper') && !e.target.closest('.position-relative')) {
    document.querySelectorAll('.tp-dropdown-menu, .tp-dropdown-panel-box').forEach(el => {
      el.classList.remove('show');
    });
  }
});

/**
 * Toggles individual session mode buttons (Online / In-Person) independently 
 * without modifying surrounding fields or forms.
 * @param {string} elementId - ID of the target button element
 */
function toggleSessionMode(elementId) {
  const button = document.getElementById(elementId);
  if (button) {
    button.classList.toggle('active');
  }
}

/**
 * Toggles individual therapy type pill states seamlessly.
 * Switches classes dynamically between outline and solid variations.
 * @param {HTMLElement} element - The button DOM node element clicked
 */
function toggleTherapyType(element) {
  if (element.classList.contains('active')) {
    element.classList.remove('active', 'tp-toggle-pill');
    element.classList.add('tp-pill-outline');
  } else {
    element.classList.add('active', 'tp-toggle-pill');
    element.classList.remove('tp-pill-outline');
  }
}

/**
 * Scoped Dropdown UI Control Toggles
 * @param {string} id - Target DOM Element Dropdown Identification Key
 */
function toggleDropdown(id) {
  document.querySelectorAll('.tp-dropdown-menu, .tp-dropdown-panel-box').forEach(el => {
    if (el.id !== id) el.classList.remove('show');
  });

  const targetMenu = document.getElementById(id);
  if (targetMenu) {
    targetMenu.classList.toggle('show');
  }
}

/**
 * Standard Document Selection Handler 
 * @param {string} documentType - Selected value string payload
 */
function selectDocument(documentType) {
  const displayLabel = document.getElementById('selectedDoc');
  if (displayLabel) {
    displayLabel.textContent = documentType;
  }

  const items = document.querySelectorAll('#docDropdown .tp-dropdown-item');
  items.forEach(item => {
    if (item.textContent === documentType) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.getElementById('docDropdown').classList.remove('show');
}

// Global click event to safely dismiss overlays outside boundary components
window.addEventListener('click', function (e) {
  if (!e.target.closest('.tp-custom-select-wrapper') && !e.target.closest('.position-relative')) {
    document.querySelectorAll('.tp-dropdown-menu, .tp-dropdown-panel-box').forEach(el => {
      el.classList.remove('show');
    });
  }
});