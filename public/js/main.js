// Notification Toggle
document.addEventListener("DOMContentLoaded", function () {
  const trigger = document.getElementById("notiTrigger");
  const panel = document.getElementById("notiPanel");

  if (trigger && panel) {
    // Toggle Functionality
    trigger.addEventListener("click", function (event) {
      event.stopPropagation(); // Event bubbling ko rokne ke liye
      panel.classList.toggle("show");
    });

    // Panel ke andar click hone par band na ho
    panel.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    // Kisi bhi bahar ki jagah par click karne par panel auto-hide ho jaye
    document.addEventListener("click", function () {
      panel.classList.remove("show");
    });
  }
});

// Date Picker Available Slots Selection
document.addEventListener("DOMContentLoaded", function () {
  const dateCells = document.querySelectorAll('.onyba-avail-date-cell:not(.onyba-avail-date-empty)');
  const dateLabel = document.getElementById('onyba-selected-date-label');

  if (dateCells.length > 0) {
    dateCells.forEach(cell => {
      cell.addEventListener('click', function() {
        document.querySelector('.onyba-avail-date--selected')?.classList.remove('onyba-avail-date--selected');
        this.classList.add('onyba-avail-date--selected');
        if (dateLabel) {
          dateLabel.textContent = `May ${this.textContent} (Selected)`;
        }
      });
    });
  }
});

// Dynamic Available Slots Add / Remove
document.addEventListener("DOMContentLoaded", function () {
  const slotsContainer = document.getElementById('onyba-slots-container');
  const addBtn = document.getElementById('onyba-add-slot-btn');

  if (addBtn && slotsContainer) {
    addBtn.addEventListener('click', function() {
      const newRow = document.createElement('div');
      newRow.className = 'onyba-avail-slot-item-row';
      
      newRow.innerHTML = `
          <div class="onyba-avail-input-time-wrap">
              <input type="text" class="onyba-avail-time-field" value="09:00">
              <span class="onyba-avail-clock-icon">🕒</span>
          </div>
          <div class="onyba-avail-select-period-wrap">
              <select class="onyba-avail-period-dropdown">
                  <option value="AM" selected>AM</option>
                  <option value="PM">PM</option>
              </select>
          </div>
          <button class="onyba-avail-btn-remove">&times;</button>
          <div class="onyba-avail-space-holder"></div>
      `;
      
      slotsContainer.appendChild(newRow);
      attachRemoveEvent(newRow.querySelector('.onyba-avail-btn-remove'));
    });
  }

  function attachRemoveEvent(button) {
    if (!button) return;
    button.addEventListener('click', function() {
      const row = this.parentElement;
      if (!row) return;
      if (!addBtn || !row.contains(addBtn)) {
        row.remove();
      } else {
        alert("Main row cannot be deleted, clear values instead!");
      }
    });
  }

  // Attach delete action to existing static rows
  document.querySelectorAll('.onyba-avail-btn-remove').forEach(btn => {
    attachRemoveEvent(btn);
  });
});

// Agenda Comment Controls
document.addEventListener("DOMContentLoaded", function () {
  const commentContainers = document.querySelectorAll('.comment-container');

  commentContainers.forEach(container => {
    const toggleBtn = container.querySelector('.toggle-comment-btn');
    const commentBox = container.querySelector('.comment-box-dropdown');
    const cancelBtn = container.querySelector('.btn-cancel');
    const submitBtn = container.querySelector('.btn-submit');

    if (toggleBtn && commentBox) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const isActive = commentBox.classList.contains('active');
        document.querySelectorAll('.comment-box-dropdown').forEach(box => {
          box.classList.remove('active');
        });
        if (!isActive) {
          commentBox.classList.add('active');
        }
      });
    }

    if (cancelBtn && commentBox) {
      cancelBtn.addEventListener('click', () => {
        commentBox.classList.remove('active');
      });
    }

    if (submitBtn && commentBox) {
      submitBtn.addEventListener('click', () => {
        commentBox.classList.remove('active');
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.comment-container')) {
      document.querySelectorAll('.comment-box-dropdown').forEach(box => {
        box.classList.remove('active');
      });
    }
  });
});

// OTP Inputs Auto-Tab and Backspace handling
document.addEventListener("DOMContentLoaded", function () {
  const inputs = document.querySelectorAll('.onyba-otp-input-box');

  if (inputs.length > 0) {
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value.length > 1) {
          e.target.value = value.slice(0, 1);
        }
        if (e.target.value !== "" && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === "Backspace") {
          if (e.target.value === "" && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = "";
          }
        }
      });
    });
  }
});

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

  const docDropdown = document.getElementById('docDropdown');
  if (docDropdown) {
    docDropdown.classList.remove('show');
  }
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
  if (!element) return;
  if (element.classList.contains('active')) {
    element.classList.remove('active', 'tp-toggle-pill');
    element.classList.add('tp-pill-outline');
  } else {
    element.classList.add('active', 'tp-toggle-pill');
    element.classList.remove('tp-pill-outline');
  }
}