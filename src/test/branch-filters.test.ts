import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DefaultLogFields, ListLogLine, SimpleGit } from 'simple-git';
import { filterBranches, setOctokitForTesting } from '../branch-filters';
import { Criteria } from '../data/criteria.enum';
import { RemotePlatform } from '../data/remote-platform.enum';
import { FilterBranchState } from '../data/filter-branch-state.interface';
import { RemoteInfo } from '../data/remote-info.interface';

suite('Branch Filters Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let gitStub: sinon.SinonStubbedInstance<SimpleGit>;
    let progressStub: sinon.SinonStubbedInstance<vscode.Progress<{ message?: string; increment?: number }>>;
    let authenticationStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        gitStub = {
            log: sandbox.stub(),
            branch: sandbox.stub(),
            tags: sandbox.stub(),
            revparse: sandbox.stub()
        } as sinon.SinonStubbedInstance<SimpleGit>;

        progressStub = {
            report: sandbox.stub()
        };

        authenticationStub = sandbox.stub(vscode.authentication, 'getSession');
        authenticationStub.resolves({ accessToken: 'fake-token' });

        global.fetch = sandbox.stub().resolves({
            ok: true,
            json: async () => ({ value: [] })
        });
    });

    teardown(() => {
        sandbox.restore();
        delete (global as any).fetch;
    });

    test('filterBranches should exclude main branch', async () => {
        const state: FilterBranchState = {
            branches: ['origin/main', 'origin/feature/test'],
            criteria: [Criteria.NoRecentCommits],
            mainBranchName: 'main',
            daysForCriteria: 30,
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            remoteInfo: null,
            remotePlatform: null
        };

        gitStub.log.resolves({
            all: [],
            total: 0,
            latest: null
        });

        const result = await filterBranches(state);

        assert.strictEqual(result.has('origin/main'), false, "main returned");
        assert.strictEqual(progressStub.report.calledTwice, true);
    });

    test('filterBranches should detect branches with no recent commits', async () => {
        const state: FilterBranchState = {
            branches: ['origin/feature/old', 'origin/feature/new'],
            criteria: [Criteria.NoRecentCommits],
            mainBranchName: 'main',
            daysForCriteria: 30,
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            remoteInfo: null,
            remotePlatform: null
        };

        gitStub.log.withArgs(['origin/feature/old']).resolves({
            all: [],
            total: 0,
            latest: null
        });

        gitStub.log.withArgs(['origin/feature/new']).resolves({
            all: [{
                date: Date.now(),
            }] as unknown as ReadonlyArray<DefaultLogFields & ListLogLine>,
            total: 1,
            latest: null
        });

        const result = await filterBranches(state);
        console.log(result);

        assert.strictEqual(result.has('origin/feature/old'), true, "old branch not returned");
        assert.strictEqual(result.has('origin/feature/new'), false, "new branch returned");
        assert.strictEqual(result.get('origin/feature/old'), Criteria.NoRecentCommits, "old branch returned not returned with NoRecentCommits");
    });

    test('filterBranches should detect merged branches', async () => {
        const state: FilterBranchState = {
            branches: ['origin/feature/merged', 'origin/feature/unmerged'],
            criteria: [Criteria.BranchesMergedIntoMain],
            mainBranchName: 'main',
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            daysForCriteria: null,
            remoteInfo: null,
            remotePlatform: null
        };

        gitStub.branch.withArgs(['-r', '--merged', 'main']).resolves({
            all: ['origin/feature/merged'],
            detached: false,
            current: '',
            branches: {}
        });

        const result = await filterBranches(state);

        assert.strictEqual(result.has('origin/feature/merged'), true);
        assert.strictEqual(result.has('origin/feature/unmerged'), false);
        assert.strictEqual(result.get('origin/feature/merged'), Criteria.BranchesMergedIntoMain);
    });

    test('filterBranches should detect branches with no associated tags', async () => {
        const state: FilterBranchState = {
            branches: ['origin/feature/no-tags', 'origin/feature/has-tags'],
            criteria: [Criteria.NoAssociatedTags],
            mainBranchName: 'main',
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            daysForCriteria: null,
            remoteInfo: null,
            remotePlatform: null
        };

        gitStub.tags.resolves({
            all: ['v1.0.0', 'v1.1.0'],
            latest: undefined
        });

        gitStub.log.withArgs(['origin/feature/no-tags']).resolves({
            all: [{
                diff: {
                    changed: 0,
                    files: [],
                    insertions: 0,
                    deletions: 0
                }
            }],
            total: 0,
            latest: null
        });

        const v1Hash = 'xyz789';
        const v11Hash = 'def456';
        gitStub.log.withArgs(['origin/feature/has-tags']).resolves({
            all: [
                {
                    hash: v1Hash,
                },
                {
                    hash: v11Hash
                }] as unknown as ReadonlyArray<DefaultLogFields & ListLogLine>,
            total: 2,
            latest: null
        });

        gitStub.revparse.withArgs(['v1.0.0']).resolves(v1Hash);
        gitStub.revparse.withArgs(['v1.1.0']).resolves(v11Hash);

        const result = await filterBranches(state);

        assert.strictEqual(result.has('origin/feature/no-tags'), true, "branch with no tags not returned");
        assert.strictEqual(result.has('origin/feature/has-tags'), false, "branch with tags returned");
    });

    test('filterBranches should apply multiple criteria correctly', async () => {
        const state: FilterBranchState = {
            branches: ['origin/feature/old-merged'],
            criteria: [Criteria.NoRecentCommits, Criteria.BranchesMergedIntoMain],
            mainBranchName: 'main',
            daysForCriteria: 30,
            git: gitStub as any,
            progress: progressStub as any,
            remoteInfo: null,
            remotePlatform: null
        };

        gitStub.log.withArgs(['origin/feature/old-merged']).resolves({
            all: [],
            total: 0,
            latest: null
        });

        gitStub.branch.withArgs(['-r', '--merged', 'main']).resolves({
            all: ['origin/feature/old-merged'],
            detached: false,
            current: '',
            branches: {}
        });

        const result = await filterBranches(state);

        assert.strictEqual(result.has('origin/feature/old-merged'), true);
        assert.strictEqual(
            result.get('origin/feature/old-merged'),
            `${Criteria.NoRecentCommits}, ${Criteria.BranchesMergedIntoMain}`
        );
    });

    test('filterBranches should detect branches with no active pull requests in GitHub', async () => {
        const remoteInfo = {
            owner: 'testOwner',
            repo: 'testRepo'
        } as RemoteInfo;
    
        const state: FilterBranchState = {
            branches: ['origin/feature/with-github-pr', 'origin/feature/without-github-pr'],
            criteria: [Criteria.NoActivePullRequests],
            mainBranchName: 'main',
            daysForCriteria: null,
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            remoteInfo: remoteInfo,
            remotePlatform: RemotePlatform.GitHub
        };
    
        const MockOctokit = function() {
            return {
                pulls: {
                    list: (params: { head: string; }) => {
                        if (params.head === 'testOwner:origin/feature/with-github-pr') {
                            return Promise.resolve({
                                data: [{ id: 1, title: 'Test GitHub PR' }]
                            });
                        } else {
                            return Promise.resolve({
                                data: []
                            });
                        }
                    }
                }
            };
        };
        
        setOctokitForTesting(MockOctokit);
        
        authenticationStub.withArgs('github', ['repo'], { createIfNone: true })
            .resolves({ accessToken: 'fake-github-token' });
    
        const result = await filterBranches(state);
    
        assert.strictEqual(result.has('origin/feature/with-github-pr'), false, "branch with GitHub PR returned");
        assert.strictEqual(result.has('origin/feature/without-github-pr'), true, "branch without GitHub PR not returned");
        assert.strictEqual(result.get('origin/feature/without-github-pr'), Criteria.NoActivePullRequests,
            "branch without GitHub PR not returned with NoActivePullRequests");
    });

    test('filterBranches should detect branches with no active pull requests in Azure DevOps', async () => {
        const remoteInfo = {
            owner: 'testOrg',
            project: 'testProject',
            repo: 'testRepo'
        };

        const state: FilterBranchState = {
            branches: ['origin/feature/with-pr', 'origin/feature/without-pr'],
            criteria: [Criteria.NoActivePullRequests],
            mainBranchName: 'main',
            daysForCriteria: null,
            git: gitStub as SimpleGit,
            progress: progressStub as vscode.Progress<{ message?: string; increment?: number; }>,
            remoteInfo: remoteInfo,
            remotePlatform: RemotePlatform.AzureDevOps
        };

        const fetchStub = global.fetch as sinon.SinonStub;

        fetchStub.withArgs(sinon.match(/feature\/with-pr/)).resolves({
            ok: true,
            json: async () => ({ value: [{ id: 1, title: 'Test PR' }] })
        });

        fetchStub.withArgs(sinon.match(/feature\/without-pr/)).resolves({
            ok: true,
            json: async () => ({ value: [] })
        });

        const result = await filterBranches(state);

        assert.strictEqual(result.has('origin/feature/with-pr'), false, "branch with PR returned");
        assert.strictEqual(result.has('origin/feature/without-pr'), true, "branch without PR not returned");
        assert.strictEqual(result.get('origin/feature/without-pr'), Criteria.NoActivePullRequests,
            "branch without PR not returned with NoActivePullRequests");
    });
});