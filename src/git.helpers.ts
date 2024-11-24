import { SimpleGit } from "simple-git";
import * as vscode from 'vscode';
import { RemoteInfo } from "./data/remote-info.interface";

export async function getRemoteUrl(git: SimpleGit): Promise<string | null> {
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
        return null;
    }

    const remoteUrl = await vscode.window.showQuickPick(
        remotes.map(r => r.refs.fetch),
        {
            placeHolder: 'Please select origin for pull request'
        }
    );

    if (!remoteUrl) {
        vscode.window.showInformationMessage('No origin selected.');
        return null;
    }

	return remoteUrl;
}

export async function getOwnerAndRepoGitHub(remoteUrl: string): Promise<RemoteInfo | null> {
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
	if (match) {
        const owner = match[1];
        const repo = match[2];
        return { owner, project: '', repo };
    }

    return null;
}

export async function getOwnerProjectRepoAzureDevOps(remoteUrl: string): Promise<RemoteInfo | null> {
    const match = remoteUrl.match(/dev\.azure\.com\/(.+?)\/(.+?)\/(\_git)\/(.+?)$/);
	if (match) {
        const owner = match[1];
		const project = match[2];
        const repo = match[4];
        return { owner, project, repo };
    }

    return null;
}