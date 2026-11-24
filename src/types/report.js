export function sectionsFromCompare(result) {
    return {
        comparisonDimensions: result.comparisonDimensions,
        keyDifferences: result.keyDifferences,
        summary: result.summary,
        nextActions: result.nextActions,
        limitations: result.limitations,
    };
}
