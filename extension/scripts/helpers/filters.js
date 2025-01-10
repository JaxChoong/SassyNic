// ---------------------- TIME ------------------------------------//
// Convert time string (HH:mm) to minutes since midnight
function timeToMinutes(timeStr) {
    if (!timeStr) return 480; // Default to 08:00 if no time provided
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Convert minutes since midnight to time string (HH:mm)
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getTimeSliders() {
    const timeStart = document.getElementById('time-start');
    const timeEnd = document.getElementById('time-end');
    const startSlider = document.createElement('input');
    const endSlider = document.createElement('input');

    const MIN_TIME = 480;  // 08:00 (8 * 60)
    const MAX_TIME = 1320; // 22:00 (22 * 60)
    const INTERVAL = 30; // minutes
    
    // Create and initialize start time slider
    startSlider.type = 'range';
    startSlider.min = MIN_TIME; 
    startSlider.max = MAX_TIME; 
    startSlider.step = INTERVAL; // 30-minute intervals
    startSlider.id = 'time-start-slider';
    startSlider.className = 'time-slider';
    
    // Create and initialize end time slider
    endSlider.type = 'range';
    endSlider.min = MIN_TIME;
    endSlider.max = MAX_TIME;
    endSlider.step = INTERVAL;
    endSlider.id = 'time-end-slider';
    endSlider.className = 'time-slider';
    
    // Insert sliders after time inputs
    timeStart.parentNode.insertBefore(startSlider, timeStart.nextSibling);
    timeEnd.parentNode.insertBefore(endSlider, timeEnd.nextSibling);
    
    // Set default values
    timeStart.value = '08:00';
    timeEnd.value = '18:00';
    startSlider.value = timeToMinutes(timeStart.value);
    endSlider.value = timeToMinutes(timeEnd.value);
    
    // Event listeners for time input changes
    timeStart.addEventListener('change', () => {
        let minutes = timeToMinutes(timeStart.value);
        
        // Enforce min/max constraints
        minutes = Math.max(MIN_TIME, Math.min(MAX_TIME, minutes));
        
        // Ensure start time doesn't exceed end time
        const endMinutes = timeToMinutes(timeEnd.value);
        if (minutes > endMinutes) {
            minutes = endMinutes;
        }
        
        // Update both time input and slider
        timeStart.value = minutesToTime(minutes);
        startSlider.value = minutes;
    });
    
    timeEnd.addEventListener('change', () => {
        let minutes = timeToMinutes(timeEnd.value);
        
        // Enforce min/max constraints
        minutes = Math.max(MIN_TIME, Math.min(MAX_TIME, minutes));
        
        // Ensure end time isn't before start time
        const startMinutes = timeToMinutes(timeStart.value);
        if (minutes < startMinutes) {
            minutes = startMinutes;
        }
        
        // Update both time input and slider
        timeEnd.value = minutesToTime(minutes);
        endSlider.value = minutes;
    });
    
    // Event listeners for slider changes
    startSlider.addEventListener('input', () => {
        const startMinutes = parseInt(startSlider.value);
        const endMinutes = parseInt(endSlider.value);
        
        // Ensure start time doesn't exceed end time
        if (startMinutes > endMinutes) {
            startSlider.value = endMinutes;
        }
        
        timeStart.value = minutesToTime(startSlider.value);
    });
    
    endSlider.addEventListener('input', () => {
        const startMinutes = parseInt(startSlider.value);
        const endMinutes = parseInt(endSlider.value);
        
        // Ensure end time doesn't precede start time
        if (endMinutes < startMinutes) {
            endSlider.value = startMinutes;
        }
        
        timeEnd.value = minutesToTime(endSlider.value);
    });

    // Add input event listeners to enforce min/max on direct input
    timeStart.addEventListener('input', (e) => {
        const inputTime = e.target.value;
        if (inputTime) {
            const minutes = timeToMinutes(inputTime);
            if (minutes < MIN_TIME || minutes > MAX_TIME) {
                e.target.value = minutesToTime(Math.max(MIN_TIME, Math.min(MAX_TIME, minutes)));
            }
        }
    });
    
    timeEnd.addEventListener('input', (e) => {
        const inputTime = e.target.value;
        if (inputTime) {
            const minutes = timeToMinutes(inputTime);
            if (minutes < MIN_TIME || minutes > MAX_TIME) {
                e.target.value = minutesToTime(Math.max(MIN_TIME, Math.min(MAX_TIME, minutes)));
            }
        }
    });
}

export function getInstructors(dataset) {
    // Get the instructor container
    const instructorContainer = document.getElementById('instructor');
    
    // Create a Set to store unique instructors
    const uniqueInstructors = new Set();
    
    // Extract all instructors from the data with correct nesting
    dataset.forEach(course => {
        course.forEach(course_ => {
            course_.option.classes.forEach(classItem => {
                classItem.misc.forEach(misc => {
                    if (misc.instructor) {
                        uniqueInstructors.add(misc.instructor);
                    }
                });
            });
        });
    });
    
    // Clear existing content except the rank display
    const rankDisplay = instructorContainer.querySelector('.rank-display');
    instructorContainer.innerHTML = '';
    if (rankDisplay) {
        instructorContainer.appendChild(rankDisplay);
    }
    
    // Add a line break after rank display
    const initialBreak = document.createElement('br');
    instructorContainer.appendChild(initialBreak);
    
    // Sort instructors alphabetically
    const sortedInstructors = Array.from(uniqueInstructors).sort();
    
    // Create HTML elements for each instructor
    sortedInstructors.forEach(instructor => {
        // Create container for each instructor
        const instructorDiv = document.createElement('div');
        instructorDiv.className = 'instructor-item';
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `instructor_${instructor.replace(/[^a-zA-Z0-9]/g, '_')}`; // id = instructor string append with '_' for each spacing
        checkbox.value = instructor;
        
        // Create label
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = instructor;
        
        // Add line break
        const lineBreak = document.createElement('br');
        
        // Append elements
        instructorDiv.appendChild(checkbox);
        instructorDiv.appendChild(label);
        instructorDiv.appendChild(lineBreak);
        instructorContainer.appendChild(instructorDiv);
    });
}