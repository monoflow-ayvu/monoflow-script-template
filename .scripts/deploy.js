const package = require('../package.json');
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
mutation createScript($name:String!, $desc:String, $settingsSchema:String, $ver: String!) {
  updateScript(description:$desc, name:$name, settingsSchema:$settingsSchema, version:$ver) {
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

async function createScriptIfNotExists() {
  ui.log.write(`⚡ Creating/updating script ${package.name} ...`);
  await graphQLClient.request(createScript, {
    name: package.name,
    desc: package.description,
    settingsSchema: JSON.stringify(package.settingsSchema || {}),
    ver: package.version,
  });
  
  ui.log.write('⚡ Fetching scripts ...');
  return (await graphQLClient.request(getScripts)).scripts || [];
}

const ui = {
  log: {
    write(...args) {
      console.log(...args);
    }
  }
};

(async function () {
  ui.log.write(`⚡ Deploying ${package.name}@${package.version} ...\n\n`);
  if (!options.force) {
    const inquirer = (await import('inquirer')).default;
    const answers = await inquirer.prompt(questions);
    if (!answers.deploy) {
      ui.log.write('❌ Deploy cancelled.');
      process.exit(1);
    }
  }

  ui.log.write('⚡ Checking if script exists ...');
  const scripts = await createScriptIfNotExists();
  
  ui.log.write('⚡ Validating versions ...');
  const isValid = isVersionValid(package.name, package.version, scripts);
  if (!isValid) {
    ui.log.write('❌ Invalid version.');
    process.exit(1);
  }

  ui.log.write('⚡ Getting script ...');
  const bundlePath = path.resolve(__dirname, '../dist/bundle.js');
  const doesExist = await exists(bundlePath);
  if (!doesExist) {
    ui.log.write('❌ Bundle not found.');
    process.exit(1);
  }
  const code = await readFile(bundlePath, 'utf8');
  
  ui.log.write('⚡ Uploading script ...');
  const uploadRes = await graphQLClient.request(uploadScript, {
    id: package.name,
    ver: package.version,
    code,
  });
  
  ui.log.write('✅ Script uploaded.');
  ui.log.write('\n\n✅ Done.');
  return true;
})().catch(e => {
  ui.log.write(`❌ ${e.message}`);
  process.exit(1);
});
