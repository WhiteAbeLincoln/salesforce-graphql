#!/usr/bin/env node

const { exec } = require('child_process')

const flatten = ffa => {
    let rLen = 0
    const len = ffa.length
    for (let i = 0; i < len; i++) {
        rLen += ffa[i].length
    }
    const r = Array(rLen)
    let start = 0
    for (let i = 0; i < len; i++) {
        const arr = ffa[i]
        const l = arr.length
        for (let j = 0; j < l; j++) {
            r[j + start] = arr[j]
        }
        start += l
    }
    return r
}

// parse audit results for exit code.
// non-zero exit code only if vulnerabilities are in non-dev dependencies
exec('npm audit --json', (err, stdout, stderr) => {
    // only throw if we get an unexpected error code
    // a non-zero return type should not throw an error
    if (err && err.code && err.signal) {
        throw err;
    }
    const result = JSON.parse(stdout)
    const advisories = Object.keys(result.advisories || {}).map(num => result.advisories[num])
    const findings = flatten(advisories.map(adv => adv.findings || []))
    if (findings.every(f => f.dev)) {
        console.error('Advisories exist, but are all for devDependencies')
        const findingStrs = advisories.map(adv => {
            const paths = (adv.findings || [])
                .map(f => `${f.dev ? '[dev] ' : ''}@${f.version}:\n\t\t${(f.paths || []).join('\n\t\t')}`)
                .join('\n\t')

            return `[${adv.severity}] ${adv.title} in ${adv.module_name} between ${adv.vulnerable_versions} and ${adv.patched_versions}:\n\t${paths}`
        }).join('\n')
        console.error(findingStrs)
        process.exit(0)
    }
    process.exit(1)
})

