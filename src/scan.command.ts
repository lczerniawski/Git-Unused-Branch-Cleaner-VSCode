import * as vscode from 'vscode';
import { initializeCommand } from "./user-interactions";
import { filterBranches } from "./branch-filters";

export async function scanCommand() {
    const commandState = await initializeCommand();
    if (!commandState) {
        return;
    }

    try {
        const branches = await commandState.git.branch(['-r']);
        const remoteBranches = branches.all;
        const filteredBranches = await filterBranches(remoteBranches, commandState.criteria, commandState.mainBranchName, commandState.daysSinceLastCommit, commandState.remoteInfo, commandState.remotePlatform, commandState.git);
        showReport(commandState.workspaceInfo.workspaceName, filteredBranches);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
    }
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