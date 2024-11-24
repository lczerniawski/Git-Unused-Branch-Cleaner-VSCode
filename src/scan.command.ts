import simpleGit, { SimpleGit } from "simple-git";
import { hasBeenMergedIntoMain, hasNoAssociatedTags, hasNoPullRequestsAzureDevOps, hasNoPullRequestsGitHub, hasNoRecentCommits } from "./branch-filters";
import { Criteria } from "./data/criteria.enum";
import { RemoteInfo } from "./data/remote-info.interface";
import { RemotePlatform } from "./data/remote-platform.enum";
import * as vscode from 'vscode';
import { getRemoteInfoAzureDevOps, getRemoteInfoGitHub, getRemoteUrl } from "./git.helpers";

export async function scanCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return;
    }

    const selectedWorkspaceFolder = await vscode.window.showQuickPick(
        workspaceFolders.map(folder => folder.name),
        {
            placeHolder: 'Select workspace folder to scan for unused branches'
        }
    );

    const workspacePath = workspaceFolders.find(folder => folder.name === selectedWorkspaceFolder)!.uri.fsPath;
    const workspaceName = workspaceFolders.find(folder => folder.name === selectedWorkspaceFolder)!.name;
    const git: SimpleGit = simpleGit(workspacePath);

    const mainBranchName = await vscode.window.showInputBox({
        'prompt': 'Enter the name of the main branch',
        validateInput: (value) => value === '' ? 'Please enter a valid branch name' : undefined
    });

    if (mainBranchName === undefined || mainBranchName === '') {
        vscode.window.showInformationMessage('Main branch name input cancelled.');
        return;
    }
    const criteria = await vscode.window.showQuickPick(
        Object.values(Criteria),
        {
            placeHolder: 'Select criteria to scan for unused branches',
            canPickMany: true
        }
    );

    if(!criteria || criteria.length === 0) {
        vscode.window.showErrorMessage('No criteria selected.');
        return;
    }
    

    let daysForCriteria;
    if (criteria.includes(Criteria.NoRecentCommits)) {
        daysForCriteria = await vscode.window.showInputBox({
            'prompt': 'Enter the number of days for criteria',
            validateInput: (value) => isNaN(Number(value)) ? 'Please enter a valid number' : undefined
        });

        if (daysForCriteria === undefined) {
            vscode.window.showInformationMessage('Days for criteria input cancelled.');
            return;
        }
    }

    let remotePlatform;
    let remoteInfo;
    if (criteria.includes(Criteria.NoPullRequests)) {
        const remoteUrl = await getRemoteUrl(git);
        if(!remoteUrl) {
            return;
        }

        if(remoteUrl.includes('github.com')) {
            remotePlatform = RemotePlatform.GitHub;
        }
        else if(remoteUrl.includes('dev.azure.com')) {
            remotePlatform = RemotePlatform.AzureDevOps;
        }
        else {
            vscode.window.showErrorMessage('Unsupported origin selected, only Github and AzureDevOps is supported.');
        }

        if(remotePlatform === RemotePlatform.GitHub) {
            remoteInfo = await getRemoteInfoGitHub(remoteUrl);
            if (!remoteInfo) {
                vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
                return;
            }
        }

        if(remotePlatform === RemotePlatform.AzureDevOps) {
            remoteInfo = await getRemoteInfoAzureDevOps(remoteUrl);
            if (!remoteInfo) {
                vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
                return;
            }
        }
    }

    try {
        const branches = await git.branch(['-r']);
        const remoteBranches = branches.all;
        const filteredBranches = await filterBranches(remoteBranches, criteria, Number(daysForCriteria), mainBranchName, remoteInfo, remotePlatform, git);
        showReport(workspaceName, filteredBranches);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
    }
}

async function filterBranches(branches: string[], criteria: string[], daysForCriteria: number, mainBranchName:string, remoteInfo: RemoteInfo | undefined, remotePlatform: string | undefined, git: SimpleGit): Promise<Map<string,string>>{
	const filteredBranches: Map<string, string> = new Map();

	for(const branch of branches) {
        if (branch.includes(mainBranchName)){
            continue;
        }

		let reason = '';
		let includeBranch = true;

		for (const criterion of criteria) {
			switch (criterion) {
				case(Criteria.NoRecentCommits):
					reason = Criteria.NoRecentCommits;
					includeBranch = await hasNoRecentCommits(branch, daysForCriteria, git);
					break;

				case(Criteria.BranchesMergedIntoMain):
					reason = Criteria.BranchesMergedIntoMain;
					includeBranch = await hasBeenMergedIntoMain(branch, mainBranchName!, git);
					break;

				case(Criteria.NoAssociatedTags):
					reason = Criteria.NoAssociatedTags;
					includeBranch = await hasNoAssociatedTags(branch, git);
					break;

				case(Criteria.NoPullRequests):
					reason = Criteria.NoPullRequests;
					if(remotePlatform === RemotePlatform.GitHub) {
						includeBranch = await hasNoPullRequestsGitHub(branch, remoteInfo!);
						break;
					}
					if(remotePlatform === RemotePlatform.AzureDevOps) {
						includeBranch = await hasNoPullRequestsAzureDevOps(branch, remoteInfo!);
						break;
					}
			}

		}

		if(includeBranch) {
			filteredBranches.set(branch, reason);
		}
	}

	return filteredBranches;
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