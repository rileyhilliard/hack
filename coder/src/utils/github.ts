import { simpleGit, type SimpleGit, type PushResult } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const reposDir = path.resolve('./repos');

interface RepoInfo {
  owner: string;
  repo: string;
  github_pat?: string;
}

export function getRepoPath(repoInfo: RepoInfo): string {
  return path.join(reposDir, `${repoInfo.owner}-${repoInfo.repo}`);
}

/**
 * Fetches a GitHub repository, cloning it if it doesn't exist
 * @param repoInfo Information about the repository to fetch
 * @returns Path to the repository
 */
export async function fetchGithubRepo(repoInfo: RepoInfo): Promise<string> {
  const { owner, repo, github_pat } = repoInfo;

  try {
    await fs.mkdir(reposDir, { recursive: true });
  } catch (error) {
    console.error('Error creating repos directory:', error);
    throw new Error('Failed to create repos directory');
  }

  // Path to the repository
  const repoPath = getRepoPath(repoInfo);

  // Check if repository already exists
  try {
    const stats = await fs.stat(repoPath);
    if (stats.isDirectory()) {
      console.log(`Repository ${owner}/${repo} already exists at ${repoPath}`);
      return repoPath;
    }
  } catch (error) {
    // Directory doesn't exist, we'll clone it
  }

  // Clone the repository
  try {
    const git: SimpleGit = simpleGit();

    // Construct the repository URL with authentication if PAT is provided
    let repoUrl = `https://github.com/${owner}/${repo}.git`;
    if (github_pat) {
      repoUrl = `https://${github_pat}@github.com/${owner}/${repo}.git`;
    }

    console.log(`Cloning repository ${owner}/${repo} to ${repoPath}...`);
    await git.clone(repoUrl, repoPath);
    console.log(`Repository ${owner}/${repo} cloned successfully`);

    return repoPath;
  } catch (error) {
    console.error(`Error cloning repository ${owner}/${repo}:`, error);
    throw new Error(`Failed to clone repository ${owner}/${repo}`);
  }
}

/**
 * Pushes changes to a GitHub repository
 * @param repoPath Path to the repository
 * @param branch Branch to push to (defaults to current branch)
 * @param message Commit message
 * @param github_pat GitHub Personal Access Token
 */
export async function pushChangesToRepo(
  repoPath: string,
  message: string,
  github_pat?: string,
  branch?: string
): Promise<PushResult> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check for changes
  const status = await git.status();
  if (status.isClean()) {
    throw new Error("No changes to commit");
  }

  // Add all changes
  await git.add('.');

  // Commit changes
  await git.commit(message);

  // Set authentication if PAT is provided
  if (github_pat) {
    const _remoteUrl = await git.remote(['get-url', 'origin']);
    const remoteUrl = _remoteUrl && _remoteUrl.replace(/\n/g, '');
    const hasGithubPath = remoteUrl.includes(github_pat);
    // if (!hasGithubPat) {
    //   const newRemoteUrl = remoteUrl.replace('https://github.com', `https://${github_pat}@github.com`);
    //   await git.remote(['set-url', 'origin', newRemoteUrl]);
    // }
    // NOTE: For the hackathon, I am forcing this as me, but if the real world it would need to work
    // via the github PAT
    if (hasGithubPath) {
      const newRemoteUrl = remoteUrl.replace(`https://${github_pat}@github.com`, 'https://github.com');
      await git.remote(['set-url', 'origin', newRemoteUrl]);
    }

    // Push changes
    if (branch) {
      return git.push('origin', branch);
    } else {
      return git.push();
    }

  } catch (error) {
    throw error;
  }
}

/**
 * Checks out a branch in a GitHub repository
 * @param repoPath Path to the repository
 * @param branchName Name of the branch to checkout
 * @param createBranch Whether to create the branch if it doesn't exist (defaults to true)
 * @param baseBranch Base branch to create from if creating a new branch (defaults to 'main')
 * @returns Promise that resolves when the branch is checked out
 */
export async function checkoutBranch(
  repoPath: string,
  branchName: string,
  github_pat: string,
  createBranch = true,
  baseBranch = 'main'
): Promise<void> {
  try {
    const git: SimpleGit = simpleGit(repoPath);

    // Check if branch exists
    const branches = await git.branch();
    const branchExists = branches.all.includes(branchName);

    if (branchExists) {
      // Checkout existing branch
      await git.checkout(branchName);

      // Pull latest changes from the branch
      await git.pull('origin', branchName).catch(() => {
        console.log(`Branch ${branchName} might not exist remotely yet, continuing...`);
      });

      // Catch up with main branch by merging main into this branch
      console.log(`Catching up branch ${branchName} with ${baseBranch}...`);
      await git.merge([baseBranch]).catch(err => {
        console.error(`Error merging ${baseBranch} into ${branchName}:`, err);
        throw new Error(`Failed to merge ${baseBranch} into ${branchName}`);
      });

      console.log(`Switched to existing branch: ${branchName} and caught up with ${baseBranch}`);
    } else if (createBranch) {
      // Make sure base branch is up to date
      await git.checkout(baseBranch);
      await git.pull('origin', baseBranch);

      // Create and checkout new branch
      await git.checkoutBranch(branchName, baseBranch);
      console.log(`Created and switched to new branch: ${branchName} (based on latest ${baseBranch})`);
    } else {
      throw new Error(`Branch ${branchName} does not exist and createBranch is set to false`);
    }
  } catch (error) {
    console.error(`Error checking out branch ${branchName}:`, error);
    throw new Error(`Failed to checkout branch ${branchName}`);
  }
}

// Function to create a pull request using GitHub CLI
export async function createPullRequest(
  owner: string,
  repo: string,
  github_pat: string,
  branchName: string,
  issueNumber: number,
  prDescription: string
): Promise<{ number: number; html_url: string }> {
  try {
    // Set the working directory to the repository path
    const repoPath = getRepoPath({ owner, repo });

    // Construct the PR title and body
    const prTitle = `Fix for issue #${issueNumber}`;
    const cleanedDescription = prDescription.replace(/["]/g, "'").replace(/[`]/g, "'");
    const prBody = `This pull request addresses issue #${issueNumber}.\n\n${cleanedDescription}`;

    // Create the PR using gh CLI
    const command = `cd ${repoPath} && gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branchName} --repo ${owner}/${repo}`;

    // Set GH_TOKEN environment variable for authentication
    const env = { ...process.env, GH_TOKEN: github_pat };

    // Execute the command
    const output = execSync(command, { encoding: 'utf8' });

    // Parse the output text to extract PR URL
    // Output format: https://github.com/owner/repo/pull/NUMBER
    const urlMatch = output.trim().match(/https:\/\/github\.com\/.*\/pull\/(\d+)/);

    if (!urlMatch) {
      throw new Error('Failed to parse PR URL from gh CLI output');
    }

    const prNumber = parseInt(urlMatch[1], 10);
    const prUrl = urlMatch[0];

    console.log(`Created PR #${prNumber}: ${prUrl}`);

    return {
      number: prNumber,
      html_url: prUrl
    };
  } catch (error) {
    throw error
  }
}
