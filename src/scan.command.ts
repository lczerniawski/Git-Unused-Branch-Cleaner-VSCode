import * as vscode from 'vscode';
import { initializeScanCommand } from "./user-interactions";
import { filterBranches } from "./branch-filters";

export async function scanCommand(context: vscode.ExtensionContext) {
    const commandState = await initializeScanCommand();
    if (!commandState) {
        return;
    }

    try {
        const branches = await commandState.git.branch(['-r']);
        const remoteBranches = branches.all;
        const filteredBranches = await filterBranches(remoteBranches, commandState.criteria, commandState.mainBranchName, commandState.daysSinceLastCommit, commandState.remoteInfo, commandState.remotePlatform, commandState.git);

        context.workspaceState.update('filteredBranches', Array.from(filteredBranches.entries()));
        context.workspaceState.update('workspaceInfo', commandState.workspaceInfo);
        vscode.window.showInformationMessage('Branches scanned and stored successfully');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
    }
}