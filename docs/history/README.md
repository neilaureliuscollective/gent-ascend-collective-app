# Preserved application history

The source in this repository continues the original application through `af2193ebd472a01954a716827cc794d458db4be6`, followed by the direct OpenAI deployment preparation.

Terminal Git push authentication was unavailable during publication. The connected GitHub integration publishes the current source snapshot; this bundle preserves all 15 original commits and their exact objects, including the original artwork and prior milestones. It is an archive, not a second application. Do not deploy or import the bundle into Vercel.

To inspect the original history without changing the current branch:

```sh
git bundle verify docs/history/pre-openai-history.bundle
git fetch docs/history/pre-openai-history.bundle main:refs/heads/archived-pre-openai
git log archived-pre-openai
```

Do not reset or force-push the current branch. New work continues from this repository's main branch.
