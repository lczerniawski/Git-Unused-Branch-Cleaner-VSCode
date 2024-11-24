import { SimpleGit } from "simple-git";
import { WorkspaceInfo } from "./workspace-info.interface";
import { RemoteInfo } from "./remote-info.interface";

export interface CommandState {
    workspaceInfo: WorkspaceInfo;
    mainBranchName: string;
    git: SimpleGit;
    criteria: string[];
    daysSinceLastCommit: number | null;
    remotePlatform: string | null;
    remoteInfo: RemoteInfo | null;
}