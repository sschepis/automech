import { configDotenv } from 'dotenv';
import { createDeepSeekClient } from './llm/deepseek.js';
import { runPipeline } from './orchestrator/pipeline.js';
configDotenv();
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command) {
        console.log(`automech - AI-Driven Mechanical Engineering Pipeline

Usage:
  automech design "<prompt>"     Design a part from a natural language prompt
  automech simulate <stl>        Run simulation on an existing STL file
  automech validate <stl>        Validate manufacturability of an STL file
  automech iterate <design-id>   Run a new iteration with empirical test data

Environment:
  DEEPSEEK_API_KEY    DeepSeek API key (loaded from .env)`);
        process.exit(0);
    }
    const llmClient = createDeepSeekClient();
    switch (command) {
        case 'design': {
            const prompt = args.slice(1).join(' ');
            if (!prompt) {
                console.error('Error: design requires a prompt argument.');
                process.exit(1);
            }
            console.log(`Architect: Parsing design prompt...\n`);
            const result = await runPipeline(llmClient, prompt);
            if (result.status === 'blocked') {
                console.log('Design requires clarification:');
                for (const q of result.errors) {
                    console.log(`  - ${q}`);
                }
                process.exit(0);
            }
            if (result.status === 'completed') {
                console.log(`Design completed successfully.`);
                console.log(`STL output: ${result.stlPath}`);
                console.log(`Dimensions: ${JSON.stringify(result.finalState?.globalConstraints.maxBoundingBox)}`);
                console.log(`Material: ${result.finalState?.globalConstraints.materialProfile.name}`);
            }
            else {
                console.log(`Design pipeline ended with status: ${result.status}`);
                if (result.errors.length > 0) {
                    console.log(`Errors: ${result.errors.slice(0, 3).join('; ')}`);
                }
            }
            break;
        }
        case 'simulate':
            console.log('Simulation mode not yet implemented.');
            break;
        case 'validate':
            console.log('Validation mode not yet implemented.');
            break;
        case 'iterate':
            console.log('Iteration mode not yet implemented.');
            break;
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}
main().catch((err) => {
    console.error('Pipeline error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map