import * as vscode from 'vscode';
import { initializeScanCommand } from "./user-interactions";
import { filterBranches } from "./branch-filters";

export async function scanCommand(context: vscode.ExtensionContext, octokit: any) {
    const commandState = await initializeScanCommand();
    if (!commandState) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Scanning branches',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Fetching remote branches...' });
            const branches = await commandState.git.branch(['-r']);
            const remoteBranches = branches.all;

            progress.report({ message: 'Filtering branches...' });
            const filterBranchesState = {
                branches: remoteBranches,
                criteria: commandState.criteria,
                mainBranchName: commandState.mainBranchName,
                daysForCriteria: commandState.daysSinceLastCommit,
                remoteInfo: commandState.remoteInfo,
                remotePlatform: commandState.remotePlatform,
                git: commandState.git,
                progress: progress
            };
            const filteredBranches = await filterBranches(filterBranchesState, octokit);
    
            context.workspaceState.update('filteredBranches', Array.from(filteredBranches.entries()));
            context.workspaceState.update('workspaceInfo', commandState.workspaceInfo);

            vscode.window.showInformationMessage('Branches scanned and stored successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
        }
    });
}