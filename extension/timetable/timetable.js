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
        filters.getTimeSliders();               // Time
        filters.getClassCloseness();            // Class Closeness
        filters.getInstructors(dataset);        // Instructors


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

        observeRanks("draggable-item", (element, newRank) => {
            console.log(element.className, "new rank: ", newRank); 
        });

    });
})();

// ------------------------- HELPER FUNCTIONS ---------------------------//
/**
 * Function to observer 'data-rank' changes in filter's elements
 * @param {String} className - element's class name
 * @param {Object} callback - callback to receive 
 */
function observeRanks(className, callback) {
    const elements = document.querySelectorAll(`.${className}`); // observe all elements with 'draggable-item class'

    // MutationObserver object
    const observer = new MutationObserver((mutationList) => {
        for(const mutation of mutationList) {
            if(mutation.type === "attributes" && mutation.attributeName === "data-rank") {
                const target = mutation.target;
                const newRank = target.getAttribute("data-rank");

                if(callback && typeof callback === "function") {
                    callback(target, newRank);
                }
            }
        }
    });

    // Start observing for rank attribute changes
    elements.forEach((element) => {
        observer.observe(element, {
            attributes: true,
            attributeFilter: ["data-rank"] // to only observer "data-rank"
        });
    });

    console.log("Observer attached: 'data-rank'");
}