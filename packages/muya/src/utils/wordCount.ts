export interface IWordCount {
    paragraph: number;
    word: number;
    character: number;
    all: number;
}

export function wordCount(markdown: string): IWordCount {
    const paragraph = markdown.split(/\n{2,}/).filter(line => line).length;
    let word = 0;
    let character = 0;

    const removedChinese = markdown.replace(/[\u4E00-\u9FA5]/g, '');
    const tokens = removedChinese.split(/\s+/).filter(token => token);
    const chineseWordLength = markdown.length - removedChinese.length;
    word += chineseWordLength + tokens.length;
    character += tokens.reduce((total, token) => total + token.length, 0) + chineseWordLength;

    return { word, paragraph, character, all: markdown.length };
}
