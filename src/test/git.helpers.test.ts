import * as assert from 'assert';
import * as vscode from 'vscode';
import { getRemoteInfoAzureDevOps, getRemoteInfoGitHub, getRemoteUrl } from '../git.helpers';

suite('Git Helper Tests Suit', () => {
	vscode.window.showInformationMessage('Start all tests.');

    test('getRemoteInfoGitHub should return owner and repo', async () => {
        const remoteUrl = 'https://github.com/owner/repo.git';
        const result = await getRemoteInfoGitHub(remoteUrl);

        assert.strictEqual(result?.owner, 'owner');
        assert.strictEqual(result?.repo, 'repo');
    });

    test('getRemoteInfoAzureDevOps should return owner, project, and repo', async () => {
        const remoteUrl = 'https://dev.azure.com/owner/project/_git/repo';
        const result = await getRemoteInfoAzureDevOps(remoteUrl);

        assert.strictEqual(result?.owner, 'owner');
        assert.strictEqual(result?.project, 'project');
        assert.strictEqual(result?.repo, 'repo');
    });

    test('getRemoteInfoGitHub should return null for invalid URL', async () => {
        const remoteUrl = 'https://invalid-url.com/owner/repo.git';
        const result = await getRemoteInfoGitHub(remoteUrl);

        assert.strictEqual(result, null);
    });

    test('getRemoteInfoAzureDevOps should return null for invalid URL', async () => {
        const remoteUrl = 'https://invalid-url.com/owner/project/_git/repo';
        const result = await getRemoteInfoAzureDevOps(remoteUrl);

        assert.strictEqual(result, null);
    });
});
