const package = require('../package.json');
const inquirer = require('inquirer');
const commander = require('commander');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { GraphQLClient, gql } = require('graphql-request');
const semver = require('semver');
const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);

const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN;
const endpoint = 'https://monoql.fly.dev/graphql';
// const endpoint = 'http://localhost:3211/graphql';
const graphQLClient = new GraphQLClient(endpoint, {
  headers: DEPLOY_TOKEN ? {
    authorization: `Bearer ${DEPLOY_TOKEN}`,
  } : {},
})

const getScripts = gql`
query scripts {
  scripts {
    id
    version
    versions {
      version
    }
  }
}
`

const uploadScript = gql`
mutation uploadScript($id:ID!, $ver:ID!, $code:String!) {
  uploadScript(
    isLatest:true,
    version: $ver,
    id:$id,
    code: $code
  ) {
    version
  }
}`

const createScript = gql`
mutation createScript($name:String!, $desc:String!) {
  createScript(settingsSchema:"{}", description:$desc, name:$name) {
    id
  }
}`

const questions = [
  {
    type: 'confirm',
    name: 'deploy',
    message: 'Are you sure you want to deploy?',
    default: false,
  },
];

commander
  .version('1.0.0', '-v, --version')
  .usage('[OPTIONS]...')
  .option('-f, --force', 'Force deploy. Do not ask for confirmation.')
  .parse(process.argv);
const options = commander.opts();

const ui = new inquirer.ui.BottomBar();

function graphqlScriptsToList(scripts) {
  return scripts.map(script => ({
    id: script.id,
    name: `${script.id}@${script.version}`,
    versions: script.versions.map(v => v.version),
  }));
}

function isVersionValid(id, version, scripts) {
  const list = graphqlScriptsToList(scripts);
  const script = list.find((s) => s.id === id);
  if (!script) {
    return true
  }

  const greaterThanAll = script.versions.every(v => semver.gt(version, v));
  if (greaterThanAll) {
    return true
  }

  return false
}

async function getAllScripts() {
  await ui.updateBottomBar('⚡ Fetching scripts ...');
  return (await graphQLClient.request(getScripts)).scripts || [];
}

async function createScriptIfNotExists(scripts) {
  const list = graphqlScriptsToList(scripts);
  const script = list.find((s) => s.id === package.name);
  if (!script) {
    ui.log.write(`⚡ Creating/updating script ${package.name} ...`);
    await graphQLClient.request(createScript, {
      name: package.name,
      desc: package.description,
    });
    return getAllScripts();
  }

  return scripts;
}

(async function () {
  ui.log.write(`⚡ Deploying ${package.name}@${package.version} ...\n\n`);
  if (!options.force) {
    const answers = await inquirer.prompt(questions);
    if (!answers.deploy) {
      ui.log.write('❌ Deploy cancelled.');
      process.exit(1);
    }
  }

  let scripts = await getAllScripts();

  await ui.updateBottomBar('⚡ Checking if script exists ...');
  scripts = await createScriptIfNotExists(scripts);
  
  await ui.updateBottomBar('⚡ Validating versions ...');
  const isValid = isVersionValid(package.name, package.version, scripts);
  if (!isValid) {
    ui.log.write('❌ Invalid version.');
    process.exit(1);
  }

  await ui.updateBottomBar('⚡ Getting script ...');
  const bundlePath = path.resolve(__dirname, '../dist/bundle.js');
  const doesExist = await exists(bundlePath);
  if (!doesExist) {
    ui.log.write('❌ Bundle not found.');
    process.exit(1);
  }
  const code = await readFile(bundlePath, 'utf8');
  
  await ui.updateBottomBar('⚡ Uploading script ...');
  const uploadRes = await graphQLClient.request(uploadScript, {
    id: package.name,
    ver: package.version,
    code,
  });
  
  ui.log.write('✅ Script uploaded.' + JSON.stringify(uploadRes, null, 2));
  ui.log.write('\n\n✅ Done.');
  process.exit();
})().catch(e => {
  ui.log.write(`❌ ${e.message}`);
  process.exit(1);
});
