import linenumber = require('linenumber');
import fs = require('fs');
import { getNamespace, getMatchingAlias, normalizeAliasTemplate } from '../template-utils';
import { TemplatePathDescription, TemplatePathMap } from '../interfaces';

function escapeRegExp (unescapedString: string) {
    return unescapedString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function isIncluded (templateName: string, file: string, line: number, allCallMaps: TemplatePathMap): boolean {
    const templatePathDescription: TemplatePathDescription[] = allCallMaps[templateName];

    if (templatePathDescription) {
        const filtered = templatePathDescription.filter(
            (templateData: TemplatePathDescription) => templateData.line === line && templateData.path === file
        );

        if (filtered.length) {
            return true;
        }
    }

    return false;
}

function insertElementWithKey (templateName: string, fileLocation: TemplatePathDescription, allCallMaps: TemplatePathMap) {
    if (Array.isArray(allCallMaps[templateName])) {
        allCallMaps[templateName].push(fileLocation);
    } else {
        allCallMaps[templateName] = new Array(fileLocation);
    }
}

function insertCalls (templateName: string, path: string, lineNrs: any[], allCallMaps: TemplatePathMap) {
    lineNrs.forEach(lineItem => {
        const line = lineItem.line - 1;

        if (!isIncluded(templateName, path, line, allCallMaps)) {
            insertElementWithKey(
                templateName,
                {
                    path,
                    line
                },
                allCallMaps
            );
        }
    });
}

export function parseFile (file: string, allCallMaps: TemplatePathMap) {
    const documentText: string = fs.readFileSync(file, 'utf8');
    const namespace: string = getNamespace(documentText);
    const callPattern: RegExp = /\{(?:del)?call ([\w\d.]+)[^\w\d.].*/gm;
    let m: RegExpExecArray;

    while (m = callPattern.exec(documentText)) {
        const lineNr = linenumber(documentText, escapeRegExp(m[0]));
        const template = m[1];

        if (template.startsWith('.')) {
            insertCalls(`${namespace}${template}`, file, lineNr, allCallMaps);
        } else {
            const alias: string = getMatchingAlias(template, documentText);

            if (alias) {
                const fullTemplatePath: string = normalizeAliasTemplate(alias, template);
                insertCalls(fullTemplatePath, file, lineNr, allCallMaps);
            } else {
                insertCalls(template, file, lineNr, allCallMaps);
            }
        }
    }
}

export function parseFilesForReferences (wsFolders: string[][]): TemplatePathMap {
    const allCallMaps: TemplatePathMap = {};

    wsFolders.forEach(
        files => files.forEach(
            file => parseFile(file, allCallMaps)
        )
    );

    return allCallMaps;
}
