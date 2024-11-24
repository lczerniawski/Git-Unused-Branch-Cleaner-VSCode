import * as vscode from 'vscode';
import { WorkspaceInfo } from './data/workspace-info.interface';

export async function showReportCommand(context: vscode.ExtensionContext) {
    const storedBranches = context.workspaceState.get<[string, string][]>('filteredBranches');
    if (!storedBranches) {
        vscode.window.showErrorMessage('No scanned branches found. Please run the scan command first.');
        return;
    }

    const storedWorkspaceInfo = context.workspaceState.get<WorkspaceInfo>('workspaceInfo');
    if (!storedWorkspaceInfo) {
        vscode.window.showErrorMessage('No workspace info found. Please run the scan command first.');
        return;
    }

    const filteredBranches = new Map(storedBranches);
    showReport(storedWorkspaceInfo.workspaceName, filteredBranches);
}


async function showReport(repoTitle: string, branches: Map<string, string>) {
    const panel = vscode.window.createWebviewPanel(
        'unusedRemoteBranchReport',
        'Unused Remote Branch Report',
        vscode.ViewColumn.One,
        {}
    );

    panel.webview.html = generateReportHtml(repoTitle, branches);
}

function generateReportHtml(repoTitle: string, branches: Map<string, string>): string {
    let html = `
        <html>
        <head>
            <style>
                :root {
                    color-scheme: light dark;
                    --background-color: var(--vscode-editor-background);
                    --text-color: var(--vscode-editor-foreground);
                    --table-header-background: var(--vscode-editor-background);
                    --table-border-color: var(--vscode-editor-foreground);
                }
                body {
                    background-color: var(--background-color);
                    color: var(--text-color);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid var(--table-border-color);
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: var(--table-header-background);
                }
            </style>
        </head>
        <body>
            <h1>${repoTitle}</h1>
            <table>
                <tr>
                    <th>Branch</th>
                    <th>Reason</th>
                </tr>
    `;

    branches.forEach((reason, branch) => {
        html += `
            <tr>
                <td>${branch}</td>
                <td>${reason}</td>
            </tr>
        `;
    });

    html += `
            </table>
        </body>
        </html>
    `;

    return html;
}