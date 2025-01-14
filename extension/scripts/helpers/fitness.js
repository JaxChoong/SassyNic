/**
 * TODO: 
 * 1. fitness score / reward calculation
 * 2. classes gap
 * 3. day filters
 * 4. time filters
 * 5. instructors filters
 */

export function getSortedDataset(dataset, filters, children, callback) {
    // Setup each filter's weight
    setFilterWeight(filters, children, (maxFitness) => {
        setMaxFitness(dataset, parseFloat(maxFitness), (dataset_) => {
            dataset = dataset_;
        });
    });

    setFitnessScore(dataset, (dataset_) => {
        dataset = dataset_;
    });
    callback(dataset);
}

/**
 * Function to set each filter's normalized weight
 * @param {NodeList} filters 
 * @param {NodeList} children 
 */
function setFilterWeight(filters, children, callback) {
    let maxFitness = 0;

    filters.forEach((filter, index) => {
        let normalised_weight = ((filters.length - index)/summation(filters.length)); // normalised weight (descending order due to priority order)

        filter.setAttribute("weight", normalised_weight);
        maxFitness += parseFloat(normalised_weight);
    });

    console.log("Filters: ", filters.length);
    console.log("Children: ", children.length);
    console.log("Max Fitness: ", parseFloat(maxFitness));

    callback(maxFitness);
}

/**
 * Function to assign maxFitness into each timetable combinations 
 * @param {Array} dataset 
 * @param {String} maxFitness 
 * @param {*} callback 
 */
function setMaxFitness(dataset, maxFitness, callback) {
    // Assign maxFitness into each combination 
    dataset.forEach(set => {
        set.fitness = maxFitness;
    });

    callback(dataset);
}

function setFitnessScore(dataset, callback) {
    dataset.forEach(set => {
        // Calcualte fitness for enabled filters
        const filters = document.querySelectorAll('div.filters div.draggable-item:not([hidden])');
        filters.forEach(filter => {
            switch(filter.id) {
                case "daysofweek":
                    set.fitness = getDayScore(set);
                    break;
            }
        });
    });

    callback(dataset.sort((a, b) => b.fitness - a.fitness));

}

// ------------------------- FITNESS SCORE FUNCTIONS ---------------------//
function getDayScore(set) {
    // Extract user-selected days and determine if "Everyday" is checked
    const childrenChecked = document.querySelectorAll(
        'div.draggable-item[id="daysofweek"] div.draggable-item-child input[type="checkbox"]:checked'
    );

    const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const selectedDays = [];
    let everydaySelected = false;

    childrenChecked.forEach((child) => {
        const rank = parseInt(child.parentElement.getAttribute("data-rank"));
        const dayId = child.id;

        if (dayId === "everyday") {
            everydaySelected = true;
        } else {
            selectedDays.push({ day: dayId.toLowerCase(), rank });
        }
    });

    // If "Everyday" is selected, calculate weights for all days
    let weights = {};
    if (everydaySelected) {
        const ranks = allDays.map((day) => {
            const element = document.querySelector(`div.draggable-item-child input[id="${day}"]`);
            return {
                day,
                rank: element ? parseInt(element.parentElement.getAttribute("data-rank")) : Infinity,
            };
        });
        const totalRank = ranks.reduce((sum, { rank }) => sum + (1 / rank), 0);
        weights = ranks.reduce((acc, { day, rank }) => {
            acc[day] = rank > 0 ? (1 / rank) / totalRank : 0; // Normalize weights
            return acc;
        }, {});
    } else {
        // Calculate weights for selected days
        const totalRank = selectedDays.reduce((sum, item) => sum + (1 / item.rank), 0);
        selectedDays.forEach(({ day, rank }) => {
            weights[day] = (1 / rank) / totalRank;
        });
    }

    // Calculate the fitness score based on the timetable
    const timetableDays = [];
    set.forEach((course) => {
        course.option.classes.forEach((classItem) => {
            classItem.misc.forEach((details) => {
                timetableDays.push(details.day.toLowerCase());
            });
        });
    });

    // Calculate objective and penalty
    const coveredDays = new Set(timetableDays);
    let objective = 0;
    let penalty = 0;

    if (everydaySelected) {
        // Reward all covered days based on their weights
        allDays.forEach((day) => {
            if (coveredDays.has(day)) {
                objective += weights[day];
            } else {
                penalty += weights[day]; // Penalize missing days
            }
        });
    } else {
        // Reward for avoiding selected days
        selectedDays.forEach(({ day }) => {
            if (!coveredDays.has(day)) {
                objective += weights[day];
            } else {
                penalty += weights[day];
            }
        });
    }

    // Final fitness score
    const fitnessScore = objective * (1 - penalty);
    return fitnessScore;
}

// ------------------------- HELPER FUNCTIONS ---------------------------//
function summation(n) {
    if(n < 1) return 0; // No natural numbers to sum
    return (n * (n+1)) / 2;
}