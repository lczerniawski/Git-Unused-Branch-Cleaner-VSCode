import { SimpleGit } from "simple-git";
import { RemoteInfo } from "./data/remote-info.interface";
let Octokit: any;
(async () => {
	Octokit = (await import('@octokit/rest')).Octokit;
})();
import * as vscode from 'vscode';

export async function hasNoRecentCommits(branch: string, daysForCriteria: number, git: SimpleGit): Promise<boolean> {
	const commits = await git.log([branch]);
	const recentCommits = commits.all.filter(commit => {
		const commitDate = new Date(commit.date);
		const daysAgo = (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
		return daysAgo <= daysForCriteria;
	});

	return recentCommits.length === 0;
} 

export async function hasBeenMergedIntoMain(branch:string, mainBranchName: string, git: SimpleGit): Promise<boolean> {
	const mergedBranches = await git.branch(['-r', '--merged', mainBranchName]);
	return mergedBranches.all.includes(branch);
}

export async function hasNoAssociatedTags(branch: string, git: SimpleGit): Promise<boolean> {
    const tags = await git.tags();
	if (tags.all.length === 0) {
		return true;
	}

    const commits = await git.log([branch]);

    for (const tag of tags.all) {
        const tagCommit = await git.revparse([tag]);
        if (commits.all.some(commit => commit.hash === tagCommit)) {
            return false;
        }
    }

    return true;
}

export async function hasNoPullRequestsGitHub(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
	const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true});
	const octokit = new Octokit({ auth: session.accessToken });

	const { owner, repo } = remoteInfo;
	const head = `${owner}:${branch.replace(repo + '/', '')}`;
	const { data: pullRequests } = await octokit.pulls.list({
		owner,
		repo,
		state: 'all',
		head
	});
	
	return pullRequests.length === 0;
}

export async function hasNoPullRequestsAzureDevOps(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
    const session = await vscode.authentication.getSession('microsoft', ['499b84ac-1321-427f-aa17-267ca6975798/.default'], { createIfNone: true });
    const token = session.accessToken;

	const branchWithoutOrigin = branch.replace('origin/', '');
    const { owner, project, repo } = remoteInfo;
	const url = `https://dev.azure.com/${owner}/${project}/_apis/git/repositories/${repo}/pullrequests?searchCriteria.sourceRefName=refs/heads/${branchWithoutOrigin}&api-version=6.0`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch pull requests: ${response.statusText}`);
    }

    const data:any = await response.json();
    const pullRequests = data.value;
    return pullRequests.length === 0;
}