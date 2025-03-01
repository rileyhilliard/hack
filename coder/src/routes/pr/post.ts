import type { Context } from 'hono';
import { fetchGithubRepo, pushChangesToRepo, checkoutBranch, getRepoPath, createPullRequest } from '@/utils/github';
import { runCodebuff } from '@/utils/codebuff';


export default async function PostPr(c: Context) {
  // get the org, repo, and instructions from the request body
  const body = await c.req.json();
  const { owner, repo, github_pat, instructions, context, issue_number } = body;

  // Validate required fields
  if (!owner || typeof owner !== 'string') {
    return c.json({ error: 'Missing or invalid owner', success: false }, 400);
  }

  if (!repo || typeof repo !== 'string') {
    return c.json({ error: 'Missing or invalid repo', success: false }, 400);
  }

  if (!instructions || typeof instructions !== 'string') {
    return c.json({ error: 'Missing or invalid instructions', success: false }, 400);
  }

  if (!issue_number) {
    return c.json({ error: 'Missing or invalid issue_number', success: false }, 400);
  }
  const repoInfo = { owner, repo, github_pat };

  try {
    // Fetch the repository
    const repoPath = getRepoPath(repoInfo);
    const branchName = `issue_${issue_number}`;
    await fetchGithubRepo(repoInfo);
    await checkoutBranch(repoPath, branchName, github_pat, true);
    // make changes
    const codebuffResult = await runCodebuff(repoPath, instructions, context);

    let pullRequestData = null;
    try {
      await pushChangesToRepo(repoPath, `🤖 fix for #${issue_number}`, github_pat, branchName);
      pullRequestData = await createPullRequest(owner, repo, github_pat, branchName, issue_number, codebuffResult.result);
    } catch (error) {
      if (error.message.includes('No changes to commit')) {
        console.log('No changes were made, so we will not create a pull request');
      } else if (error.message.includes('already exists')) {
        console.log('Pull request already exists, and an update was already pushed, so its in sync');
      } else {
        throw error;
      }
    }

    // Return the response with the repository path
    return c.json({
      owner,
      repo,
      issue_number,
      success: !!pullRequestData,
      pullRequest: pullRequestData ? {
        number: pullRequestData.number,
        url: pullRequestData.html_url
      } : null,
      fixDescription: codebuffResult.result
    });
  } catch (error) {
    console.error('Error fetching repository:', error);
    return c.json({
      error: 'Failed to fetch repository',
      message: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, 500);
  }
};