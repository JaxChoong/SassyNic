console.log("timetable.js loaded");
chrome.runtime.sendMessage({ action: "timetablejsInjected" });

(async() => {
    document.addEventListener("DOMContentLoaded", async() => {
        let dataset;

        // ---------------------- MESSAGE PASSING --------------------------------//
        // Listen message from background.js
        const getDataset = new Promise((resolve) => {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if(message.action === "passDataset") {
                    dataset = message.dataset;
                    resolve(dataset);

                    sendResponse({ status: "Pruned dataset received successfully from background.js" });
                }
                return true; // keep message port open for receiving message
            });
        });
        dataset = await getDataset; // load dataset

        // ---------------------- HTML DOM ELEMENTS ------------------------------//
        // ---------------------- FILTERS ----------------------------------------//
        // Filters 
        const src_filters = chrome.runtime.getURL('../scripts/helpers/filters.js');
        const filters = await import(src_filters);

        filters.getDaysOfWeek();                // Days of week 
        filters.getTimeSliders(dataset);        // Time
        filters.getClassGap(dataset);           // Class Gap
        filters.getInstructors(dataset);        // Instructors

        // Observe filter's ranking changes
        observeRanks("draggable-item", (changes) => {
            console.log("--------------------------------------------------------------");

            changes.forEach(({ element, newRank }) => {
                console.log(
                    element.className.includes('draggable-item-child')
                        ? `new rank: ${newRank}, ${element.querySelector('label').textContent}` // For child items
                        : `new rank: ${newRank}, ${element.querySelector('span').textContent.replace(/[0-9]*./, "").trim()}` // For parent items
                );
            });

            // console.log("--------------------------------------------------------------");
        });

        // Observer filter's elements value changes
        observeFiltersValues((result) => {
            const elementId = result.element.id;
            
            if (result.type === 'checkbox') {
                // console.log("--------------------------------------------------------------");
                console.log(`${result.element.id} is ${result.value}`);
                console.log(result.element);
                console.log("--------------------------------------------------------------");
            }
            else if (result.type === 'range') {
                const valueDisplay = document.getElementById(`${elementId}_value`);
                if (valueDisplay) {
                    valueDisplay.textContent = result.value;
                }
                // console.log("--------------------------------------------------------------");
                console.log(`${elementId}: ${result.value} (${result.percentage}%)`);
                console.log(result.element);
                console.log("--------------------------------------------------------------");
            }
            else if (result.type === 'time') {
                // console.log("--------------------------------------------------------------");
                console.log(`${elementId}: ${result.value}`);
                console.log(result.element);
                console.log("--------------------------------------------------------------");
            }
            else if (result.type === 'select') {
                // console.log("--------------------------------------------------------------");
                console.log(`${elementId}: ${result.value}`);
                console.log(result.element);
                console.log("--------------------------------------------------------------");
            }
        });

        // ---------------------- DRAG AND DROP -----------------------------------//
        const src_dragndrop = chrome.runtime.getURL('../scripts/helpers/dragndrop.js');
        const dragndrop = await import(src_dragndrop);

        dragndrop.getDragDrop();

        // ---------------------- TIMETABLE TABLE ---------------------------------//
        // Timetable table
        const src_table = chrome.runtime.getURL('../scripts/helpers/table.js');
        const table = await import(src_table);

        table.getTable(dataset);

        // ------------------------- FITNESS FUNCTIONS ---------------------------//
        const src_fitness = chrome.runtime.getURL('../scripts/helpers/fitness.js');
        const fitness = await import(src_fitness); 

        // Filters selection
        const filters_selection = document.querySelectorAll('div.selection input[type="checkbox"]');
        filters_selection.forEach(filter => {
            filter.addEventListener('change', () => {
                if(!filter.checked) {
                    document.querySelector(`div.filters .${filter.id.replace('filter_', '')}`).setAttribute('hidden', 'true');
                    dragndrop.getDragDrop(); // update filter's rank
                }
                if(filter.checked) {
                    document.querySelector(`div.filters .${filter.id.replace('filter_', '')}`).removeAttribute('hidden');
                    dragndrop.getDragDrop(); // udpate filter's rank

                    // ------------------------- UPDATE TABLE BASED ON FITNESS SCORE ---------------------------//
                    // Setup filter's weight
                    const filters_final = document.querySelectorAll('div.filters div.draggable-item:not([hidden])');
                    console.log("Total Filters to be sent into 'fitness.js': ", filters_final.length);
                    fitness.setFilterWeight(filters_final)
                }
            });
        });


    });
})();

// ------------------------- HELPER FUNCTIONS ---------------------------//
/**
 * Function to observe 'data-rank' changes in filter's elements
 * @param {String} className - element's class name
 */
function observeRanks(className, callback) {
    const elements = document.querySelectorAll(`.${className}`); // Select elements with the given class

    // MutationObserver to monitor attribute changes
    const observer = new MutationObserver((mutationList) => {
        const changes = []; // Accumulate changes for grouped output

        mutationList.forEach((mutation) => {
            if (mutation.type === "attributes" && mutation.attributeName === "data-rank") {
                const target = mutation.target;
                const newRank = target.getAttribute("data-rank");

                // Collect structured results for the callback
                changes.push({
                    element: target,
                    newRank,
                });
            }
        });

        // Trigger the callback with accumulated changes if there are any
        if (changes.length > 0 && typeof callback === "function") {
            callback(changes);
        }
    });

    // Start observing the elements for 'data-rank' attribute changes
    elements.forEach((element) => {
        observer.observe(element, {
            attributes: true,
            attributeFilter: ["data-rank"], // Observe only "data-rank"
        });
    });

    console.log(`Observer attached to elements with class '${className}' for 'data-rank' changes.`);
}


/**
 * Function to observe 'value' changes in filter's elements
 * @param {Object} callback 
 * @returns {null} - cleanup function
 */
function observeFiltersValues(callback) {
    const container = document.getElementById('filters');
    if (!container) {
        console.error("Element with id 'filters' not found.");
        return;
    }

    // Store elements that already have listeners
    const processedElements = new WeakSet();
    const spansMap = new WeakMap(); // Track spans by parent div and selection
    let hasAttachments = false;

    // Print divider line
    const printDivider = () => {
        console.log('--------------------------------------------------------------');
    };

    // Time conversion utilities
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const minutesToTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        return `${hours.toString().padStart(2, '0')}:00`;
    };

    // Helper function to remove a span and its associated BR element
    const removeSpanAndBr = (span) => {
        if (span && span.parentNode) {
            // Remove the BR element before the span if it exists
            if (span.previousElementSibling && span.previousElementSibling.tagName === 'BR') {
                span.previousElementSibling.remove();
            }
            span.remove();
        }
    };

    // Span creation and update utility
    const createOrUpdateSpan = (parentDiv, selection, details) => {
        let span;
        if (!spansMap.has(parentDiv)) {
            spansMap.set(parentDiv, {});
        }

        const spansBySelection = spansMap.get(parentDiv);

        // If selection is "Everyday", remove all other spans
        if (selection === "Everyday") {
            // Remove all existing spans
            Object.entries(spansBySelection).forEach(([key, existingSpan]) => {
                if (key !== "Everyday") {
                    removeSpanAndBr(existingSpan);
                    delete spansBySelection[key];
                }
            });
        } else {
            // If selection is not "Everyday", remove the "Everyday" span if it exists
            if (spansBySelection["Everyday"]) {
                removeSpanAndBr(spansBySelection["Everyday"]);
                delete spansBySelection["Everyday"];
            }
        }

        if (spansBySelection[selection]) {
            span = spansBySelection[selection];
        } else {
            span = document.createElement('span');
            span.className = 'details-display';
            parentDiv.appendChild(document.createElement('br'));
            parentDiv.appendChild(span);
            spansBySelection[selection] = span;
        }

        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'x';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', () => {
            removeSpanAndBr(span)
            delete spansBySelection[selection];
        });

        span.innerHTML = `<strong>${selection}</strong><br>${details} `;
        span.appendChild(deleteButton);
    };


    // Handle checkbox changes
    const handleCheckboxes = () => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        let newAttachments = 0;
        
        checkboxes.forEach(checkbox => {
            if (!processedElements.has(checkbox)) {
                const changeHandler = (event) => {
                    callback({
                        type: 'checkbox',
                        value: event.target.checked ? 'checked' : 'unchecked',
                        element: event.target
                    });
                };
                
                checkbox.addEventListener('change', changeHandler);
                processedElements.add(checkbox);
                newAttachments++;
            }
        });

        if (newAttachments > 0) {
            if (!hasAttachments) {
                printDivider();
                hasAttachments = true;
            }
            console.log('Observer attached: checkboxes');
        }
    };

    // Handle time input changes
    const handleTimeInputs = () => {
        const timeInputs = container.querySelectorAll('input[type="time"]');
        let newAttachments = 0;
        
        timeInputs.forEach(timeInput => {
            if (!processedElements.has(timeInput)) {
                const changeHandler = (event) => {
                    callback({
                        type: 'time',
                        value: event.target.value,
                        element: event.target
                    });
                };
                
                timeInput.addEventListener('change', changeHandler);
                processedElements.add(timeInput);
                newAttachments++;
            }
        });

        if (newAttachments > 0) {
            if (!hasAttachments) {
                printDivider();
                hasAttachments = true;
            }
            console.log('Observer attached: time inputs');
        }
    };

    // Handle range slider changes with time display functionality
    const handleTimeRangeInputs = () => {
        const timeDivs = container.querySelectorAll('div.time[show-details="true"]');
        let newAttachments = 0;

        timeDivs.forEach(timeDiv => {
            const timeStart = timeDiv.querySelector('#time-start');
            const timeEnd = timeDiv.querySelector('#time-end');
            const startSlider = timeDiv.querySelector('#time-start-slider');
            const endSlider = timeDiv.querySelector('#time-end-slider');
            const selectElement = timeDiv.querySelector('select');

            if (timeStart && timeEnd && startSlider && endSlider && selectElement) {
                const updateDetails = () => {
                    const selection = selectElement.options[selectElement.selectedIndex].text;
                    const details = `Start: ${minutesToTime(parseInt(startSlider.value))} End: ${minutesToTime(parseInt(endSlider.value))}`;
                    createOrUpdateSpan(timeDiv, selection, details);
                };

                if (!processedElements.has(startSlider)) {
                    let timeout;
                    startSlider.addEventListener('input', () => {
                        clearTimeout(timeout);  // Clear any pending timeout
                        timeout = setTimeout(() => {
                            timeStart.value = minutesToTime(parseInt(startSlider.value));
                            updateDetails();

                            callback({
                                type: 'range',
                                value: startSlider.value,
                                percentage: Math.round((startSlider.value / startSlider.max) * 100),
                                element: startSlider
                            });
                        }, 300);  // Delay of 300ms
                    });
                    processedElements.add(startSlider);
                    newAttachments++;
                }

                if (!processedElements.has(endSlider)) {
                    let timeout;
                    endSlider.addEventListener('input', () => {
                        clearTimeout(timeout);  // Clear any pending timeout
                        timeout = setTimeout(() => {
                            timeEnd.value = minutesToTime(parseInt(endSlider.value));
                            updateDetails();

                            callback({
                                type: 'range',
                                value: endSlider.value,
                                percentage: Math.round((endSlider.value / endSlider.max) * 100),
                                element: endSlider
                            });
                        }, 300);  // Delay of 300ms
                    });
                    processedElements.add(endSlider);
                    newAttachments++;
                }
            }
        });

        if (newAttachments > 0) {
            if (!hasAttachments) {
                printDivider();
                hasAttachments = true;
            }
            console.log('Observer attached: time sliders');
        }
    };

    // Handle gap slider changes
    const handleGapRangeInputs = () => {
        const gapDivs = container.querySelectorAll('div.gap[show-details="true"]');
        let newAttachments = 0;

        gapDivs.forEach(gapDiv => {
            const gapSlider = gapDiv.querySelector('#class_gap');
            const gapValue = gapDiv.querySelector('#class_gap_value');
            const selectElement = gapDiv.querySelector('select');

            if (gapSlider && gapValue && selectElement) {
                const updateDetails = () => {
                    const selection = selectElement.options[selectElement.selectedIndex].text;
                    const details = `Gap: ${gapSlider.value} minutes`;
                    createOrUpdateSpan(gapDiv, selection, details);
                };

                if (!processedElements.has(gapSlider)) {
                    let timeout;
                    gapSlider.addEventListener('input', () => {
                        clearTimeout(timeout);  // Clear any pending timeout
                        timeout = setTimeout(() => {
                            gapValue.textContent = gapSlider.value;
                            updateDetails();

                            callback({
                                type: 'range',
                                value: gapSlider.value,
                                percentage: Math.round((gapSlider.value / gapSlider.max) * 100),
                                element: gapSlider
                            });
                        }, 300);  // Delay of 300ms
                    });
                    processedElements.add(gapSlider);
                    newAttachments++;
                }
            }
        });

        if (newAttachments > 0) {
            if (!hasAttachments) {
                printDivider();
                hasAttachments = true;
            }
            console.log('Observer attached: gap sliders');
        }
    };

    // Handle select option changes
    const handleSelectOptions = () => {
        const selects = container.querySelectorAll('select');
        let newAttachments = 0;

        selects.forEach(select => {
            if (!processedElements.has(select)) {
                const changeHandler = (event) => {
                    const selectedOption = event.target.options[event.target.selectedIndex];
                    callback({
                        type: 'select',
                        value: selectedOption.value,
                        text: selectedOption.text,
                        element: event.target
                    });

                    // Update details based on parent div type
                    const parentDiv = event.target.closest('div[show-details="true"]');
                    if (parentDiv) {
                        if (parentDiv.classList.contains('time')) {
                            const startSlider = parentDiv.querySelector('#time-start-slider');
                            const endSlider = parentDiv.querySelector('#time-end-slider');

                            if (startSlider && endSlider) {
                                let details;
                                const spansBySelection = spansMap.get(parentDiv);
                                if (spansBySelection && spansBySelection[selectedOption.text]) {
                                    details = spansBySelection[selectedOption.text].details;
                                } else {
                                    details = `Start: ${minutesToTime(parseInt(startSlider.value))} End: ${minutesToTime(parseInt(endSlider.value))}`;
                                    createOrUpdateSpan(parentDiv, selectedOption.text, details);
                                }

                                if (details) {  // Check if details exist
                                    startSlider.value = timeToMinutes(details.split('End: ')[0].split('Start: ')[1].trim());
                                    endSlider.value = timeToMinutes(details.split('End: ')[1].trim());
                                }
                            }
                        } else if (parentDiv.classList.contains('gap')) {
                            const gapSlider = parentDiv.querySelector('#class_gap');

                            if (gapSlider) {
                                let details;
                                const spansBySelection = spansMap.get(parentDiv);
                                if (spansBySelection && spansBySelection[selectedOption.text]) {
                                    details = spansBySelection[selectedOption.text].details;
                                } else {
                                    details = `Gap: ${gapSlider.value} minutes`;
                                    createOrUpdateSpan(parentDiv, selectedOption.text, details);
                                }

                                if (details) {  // Check if details exist
                                    gapSlider.value = parseInt(details.split('Gap: ')[1].trim().split(' ')[0]);
                                }
                            }
                        }
                    }
                };

                select.addEventListener('change', changeHandler);
                processedElements.add(select);
                newAttachments++;
            }
        });

        if (newAttachments > 0) {
            if (!hasAttachments) {
                printDivider();
                hasAttachments = true;
            }
            console.log('Observer attached: select elements');
        }
    };

    // Initialize observers for all input types
    handleCheckboxes();
    handleTimeInputs();
    handleTimeRangeInputs();
    handleGapRangeInputs();
    handleSelectOptions();

    // Print final divider if any attachments were made
    if (hasAttachments) {
        printDivider();
    }

    // Optional: Observe DOM changes to handle dynamically added elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                handleCheckboxes();
                handleTimeInputs();
                handleTimeRangeInputs();
                handleGapRangeInputs();
                handleSelectOptions();
            }
        });
    });

    // Start observing the container for added nodes
    observer.observe(container, {
        childList: true,
        subtree: true
    });

    // Return cleanup function
    return () => {
        observer.disconnect();
        processedElements.clear();
        spansMap.clear();
    };
}
