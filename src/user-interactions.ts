import { Criteria } from "./data/criteria.enum";
import { RemoteInfo } from "./data/remote-info.interface";
import { RemotePlatform } from "./data/remote-platform.enum";
import { WorkspaceInfo } from "./data/workspace-info.interface";
import * as vscode from 'vscode';
import { getRemoteInfoAzureDevOps, getRemoteInfoGitHub, getRemoteUrl } from "./git.helpers";
import simpleGit, { SimpleGit } from "simple-git";
import { CommandState } from "./data/command-state.interface";

export async function initializeCommand(): Promise<CommandState | null> {
    const workspaceInfo = await getWorkspacePathAndName();
    if (!workspaceInfo) {
        return null;
    }

    const git: SimpleGit = simpleGit(workspaceInfo.workspacePath);
    const mainBranchName = await getMainBranchName();
    if (!mainBranchName) {
        return null;
    }

    const criteria = await getCriteria();
    if (!criteria) {
        return null;
    }
    
    let daysSinceLastCommit = null;
    if (criteria.includes(Criteria.NoRecentCommits)) {
        daysSinceLastCommit = await getDaysSinceLastCommit();
    }

    let remotePlatform = null;
    let remoteInfo = null;
    if (criteria.includes(Criteria.NoActivePullRequests)) {
        const remoteUrl = await getRemoteUrl(git);
        if(!remoteUrl) {
            return null;
        }

        remotePlatform = getRemotePlatform(remoteUrl);
        if(remotePlatform === null) {
            return null;
        }

        remoteInfo = await getRemoteInfo(remoteUrl, remotePlatform);
        if(!remoteInfo) {
            return null;
        }
    }

    return { workspaceInfo, mainBranchName, git, criteria, daysSinceLastCommit: daysSinceLastCommit !== null ? Number(daysSinceLastCommit) : null, remotePlatform, remoteInfo };
}

async function getWorkspacePathAndName(): Promise<WorkspaceInfo | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return null;
    }

    const selectedWorkspaceFolder = await vscode.window.showQuickPick(
        workspaceFolders.map(folder => folder.name),
        {
            placeHolder: 'Select workspace folder to scan for unused branches'
        }
    );

    const workspacePath = workspaceFolders.find(folder => folder.name === selectedWorkspaceFolder)!.uri.fsPath;
    const workspaceName = workspaceFolders.find(folder => folder.name === selectedWorkspaceFolder)!.name;

    return { workspacePath, workspaceName };
}

async function getMainBranchName(): Promise<string | null> {
    const mainBranchName = await vscode.window.showInputBox({
        'prompt': 'Enter the name of the main branch',
        validateInput: (value) => value === '' ? 'Please enter a valid branch name' : undefined
    });

    if (mainBranchName === undefined || mainBranchName === '') {
        vscode.window.showInformationMessage('Main branch name input cancelled.');
        return null;
    }

    return mainBranchName;
}

async function getCriteria(): Promise<string[] | null> {
    const criteria = await vscode.window.showQuickPick(
        Object.values(Criteria),
        {
            placeHolder: 'Select criteria to scan for unused branches',
            canPickMany: true
        }
    );

    if(!criteria || criteria.length === 0) {
        vscode.window.showErrorMessage('No criteria selected.');
        return null;
    }

    return criteria;
}

async function getDaysSinceLastCommit(): Promise<string | null> {
    const daysSinceLastCommit = await vscode.window.showInputBox({
        'prompt': 'Enter the number of days since the last commit',
        validateInput: (value) => isNaN(Number(value)) ? 'Please enter a valid number' : undefined
    });

    if (daysSinceLastCommit === undefined) {
        vscode.window.showInformationMessage('Days for criteria input cancelled.');
        return null;
    }

    return daysSinceLastCommit;
}

function getRemotePlatform(remoteUrl: string): string | null {
    if(remoteUrl.includes('github.com')) {
        return RemotePlatform.GitHub;
    }
    else if(remoteUrl.includes('dev.azure.com')) {
        return RemotePlatform.AzureDevOps;
    }
    else {
        vscode.window.showErrorMessage('Unsupported origin selected, only Github and AzureDevOps is supported.');
        return null;
    }
}

async function getRemoteInfo(remoteUrl: string, remotePlatform: string): Promise<RemoteInfo | null> {
    if(remotePlatform === RemotePlatform.GitHub) {
        const remoteInfo = await getRemoteInfoGitHub(remoteUrl);
        if (!remoteInfo) {
            vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
            return null;
        }

        return remoteInfo;
    }

    if(remotePlatform === RemotePlatform.AzureDevOps) {
        const remoteInfo = await getRemoteInfoAzureDevOps(remoteUrl);
        if (!remoteInfo) {
            vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
            return null;
        }

        return remoteInfo;
    }

    return null;
}