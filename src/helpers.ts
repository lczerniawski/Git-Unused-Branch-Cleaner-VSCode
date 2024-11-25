export function splitAtFirstDelimiter(input: string, delimiter: string): Result | null {
    const index = input.indexOf(delimiter);
    if (index === -1) {
        return null;
    }
    const firstPart = input.substring(0, index);
    const secondPart = input.substring(index + 1);
    return { firstPart, secondPart };
}

interface Result {
    firstPart: string;
    secondPart: string;
}