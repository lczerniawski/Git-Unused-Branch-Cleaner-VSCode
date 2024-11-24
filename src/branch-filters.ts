import { SimpleGit } from "simple-git";
import { RemoteInfo } from "./data/remote-info.interface";
let Octokit: any;
(async () => {
	Octokit = (await import('@octokit/rest')).Octokit;
})();
import * as vscode from 'vscode';
import { Criteria } from "./data/criteria.enum";
import { RemotePlatform } from "./data/remote-platform.enum";

export async function filterBranches(branches: string[], criteria: string[], mainBranchName:string, daysForCriteria: number | null, remoteInfo: RemoteInfo | null, remotePlatform: string | null, git: SimpleGit): Promise<Map<string,string>>{
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
					includeBranch = await hasNoRecentCommits(branch, daysForCriteria!, git);
					break;

				case(Criteria.BranchesMergedIntoMain):
					reason = Criteria.BranchesMergedIntoMain;
					includeBranch = await hasBeenMergedIntoMain(branch, mainBranchName!, git);
					break;

				case(Criteria.NoAssociatedTags):
					reason = Criteria.NoAssociatedTags;
					includeBranch = await hasNoAssociatedTags(branch, git);
					break;

				case(Criteria.NoActivePullRequests):
					reason = Criteria.NoActivePullRequests;
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

async function hasNoRecentCommits(branch: string, daysForCriteria: number, git: SimpleGit): Promise<boolean> {
	const commits = await git.log([branch]);
	const recentCommits = commits.all.filter(commit => {
		const commitDate = new Date(commit.date);
		const daysAgo = (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
		return daysAgo <= daysForCriteria;
	});

	return recentCommits.length === 0;
} 

async function hasBeenMergedIntoMain(branch:string, mainBranchName: string, git: SimpleGit): Promise<boolean> {
	const mergedBranches = await git.branch(['-r', '--merged', mainBranchName]);
	return mergedBranches.all.includes(branch);
}

async function hasNoAssociatedTags(branch: string, git: SimpleGit): Promise<boolean> {
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

async function hasNoPullRequestsGitHub(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
	const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true});
	const octokit = new Octokit({ auth: session.accessToken });

	const { owner, repo } = remoteInfo;
	const head = `${owner}:${branch.replace(repo + '/', '')}`;
	const { data: pullRequests } = await octokit.pulls.list({
		owner,
		repo,
		state: 'open',
		head
	});
	
	return pullRequests.length === 0;
}

async function hasNoPullRequestsAzureDevOps(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
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