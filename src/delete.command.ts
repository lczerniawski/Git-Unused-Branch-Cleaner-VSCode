import * as vscode from 'vscode';
import { initializeCommand } from "./user-interactions";
import { filterBranches } from "./branch-filters";
import { RemotePlatform } from './data/remote-platform.enum';

export async function deleteCommand() {
    const commandState = await initializeCommand();
    if (!commandState) {
        return;
    }

    try {
        const branches = await commandState.git.branch(['-r']);
        const remoteBranches = branches.all;
        const filteredBranches = await filterBranches(remoteBranches, commandState.criteria, commandState.mainBranchName, commandState.daysSinceLastCommit, commandState.remoteInfo, commandState.remotePlatform, commandState.git);

        const branchesToDelete = await vscode.window.showQuickPick(Array.from(filteredBranches.keys()), {
            canPickMany: true,
            placeHolder: 'Select branches to delete'
        });

        if (!branchesToDelete || branchesToDelete.length === 0) {
            vscode.window.showInformationMessage('No branches selected for deletion');
            return;
        }

        for (let branch of branchesToDelete) {
            const remoteAndBranchName = splitAtFirstDelimiter(branch, '/');
            if (!remoteAndBranchName) {
                vscode.window.showErrorMessage(`Invalid branch name: ${branch}`);
                continue;
            }

            await commandState.git.push([remoteAndBranchName[0], '--delete', remoteAndBranchName[1]]);
        }

        vscode.window.showInformationMessage('Branches deleted successfully');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
    }
}

function splitAtFirstDelimiter(input: string, delimiter: string): [string, string] | null {
    const index = input.indexOf(delimiter);
    if (index === -1) {
        return null;
    }
    const firstPart = input.substring(0, index);
    const secondPart = input.substring(index + 1);
    return [firstPart, secondPart];
}