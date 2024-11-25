import * as vscode from 'vscode';
import { WorkspaceInfo } from './data/workspace-info.interface';
import simpleGit from 'simple-git';
import * as helpers from './helpers';

export async function deleteCommand(context: vscode.ExtensionContext) {
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

    const git = simpleGit(storedWorkspaceInfo.workspacePath);
    const filteredBranches = new Map(storedBranches);
    const branchesToDelete = await vscode.window.showQuickPick(Array.from(filteredBranches.keys()), {
        canPickMany: true,
        placeHolder: 'Select branches to delete'
    });

    if (!branchesToDelete || branchesToDelete.length === 0) {
        vscode.window.showInformationMessage('No branches selected for deletion');
        return;
    }

    try {
        for (let branch of branchesToDelete) {
            const remoteAndBranchName = helpers.splitAtFirstDelimiter(branch, '/');
            if (!remoteAndBranchName) {
                vscode.window.showErrorMessage(`Invalid branch name: ${branch}`);
                continue;
            }

            await git.push([remoteAndBranchName.firstPart, '--delete', remoteAndBranchName.secondPart]);
        }

        vscode.window.showInformationMessage('Branches deleted successfully');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
    }
}

