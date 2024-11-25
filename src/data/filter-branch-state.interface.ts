import { SimpleGit } from "simple-git";
import { RemoteInfo } from "./remote-info.interface";
import * as vscode from 'vscode';

export interface FilterBranchState {
    branches: string[]; 
    criteria: string[]; 
    mainBranchName:string; 
    daysForCriteria: number | null; 
    remoteInfo: RemoteInfo | null; 
    remotePlatform: string | null; 
    git: SimpleGit;
    progress: vscode.Progress<{message?: string;increment?: number;}>
}