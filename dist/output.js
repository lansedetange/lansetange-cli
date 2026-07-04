const BOX_WIDTH = 96;
export function printWelcomeBanner() {
    printBox([
        '████████╗ █████╗ ███╗   ██╗███████╗████████╗ █████╗ ██████╗ ████████╗███████╗██████╗',
        '╚══██╔══╝██╔══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██╔══██╗',
        '   ██║   ███████║██╔██╗ ██║███████╗   ██║   ███████║██████╔╝   ██║   █████╗  ██████╔╝',
        '   ██║   ██╔══██║██║╚██╗██║╚════██║   ██║   ██╔══██║██╔══██╗   ██║   ██╔══╝  ██╔══██╗',
        '   ██║   ██║  ██║██║ ╚████║███████║   ██║   ██║  ██║██║  ██║   ██║   ███████╗██║  ██║',
        '   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝',
        '',
        'Website: https://tanstarter.dev',
        'Docs:    https://docs.tanstarter.dev',
        'Video:   https://docs.tanstarter.dev/video',
    ]);
}
export function printStep(index, total, title) {
    printBox([`🚀 Step ${index}/${total}: ${title}`]);
}
export function printCompletedStep(title) {
    console.log(`✅ ${title} completed`);
}
export function printFinalSummary(config) {
    const productionUrl = (config.domain ? `https://${config.domain}` : config.deploymentUrl) ||
        '(check Wrangler deploy output)';
    const githubUrl = config.githubRepoUrl || githubRepoToUrl(config.githubRepo);
    printBox([
        '🎉 TanStarter project is ready',
        '',
        `Project: ${config.projectName}`,
        `Directory: ${config.targetDir}`,
        `Production URL: ${productionUrl}`,
        `GitHub repo: ${githubUrl}`,
        `Delete later: npx tanstarter-cli@latest delete ${config.projectName}`,
    ]);
}
function printBox(lines) {
    const border = '═'.repeat(BOX_WIDTH - 2);
    console.log(`\n╔${border}╗`);
    for (const line of lines) {
        console.log(`║ ${fitLine(line)} ║`);
    }
    console.log(`╚${border}╝`);
}
function fitLine(line) {
    const maxLength = BOX_WIDTH - 4;
    if (line.length <= maxLength)
        return line.padEnd(maxLength, ' ');
    return `${line.slice(0, maxLength - 1)}…`;
}
function githubRepoToUrl(repo) {
    return repo.includes('/') ? `https://github.com/${repo}` : repo;
}
