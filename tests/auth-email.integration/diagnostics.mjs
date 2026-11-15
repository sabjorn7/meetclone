// Reduces private container/CLI logs to fixed diagnostic labels. NEVER echoes a raw line.
let text = '';
for await (const chunk of process.stdin) { if (text.length < 4 * 1024 * 1024) text += chunk; }
const rules = {
    unsupported_node_version: /does not have any version|unknown node version|unrecognized node type|unknown node type/i,
    missing_runtime_module: /cannot find module/i,
    binary_helper_failure: /getBinaryDataBuffer/i,
    database_permission_denied: /permission denied/i,
    database_migration_failure: /migration.*(?:failed|error)|(?:failed|error).*migration/i,
    database_role_missing: /role .*does not exist/i,
    database_object_missing: /(?:relation|function|schema) .*does not exist/i,
    database_authentication_failure: /password authentication failed/i,
    tls_trust_failure: /self.signed|unable to verify|x509|unknown authority|certificate verify failed/i,
    import_failed: /fixture_n8n_import_failure/i,
    activation_failed: /fixture_n8n_activate_failure/i,
    owner_or_project_failure: /could not find.*(?:owner|user|project)|(?:owner|project).*not found/i,
    bind_permission_failure: /EACCES|EPERM/i,
};
const labels = Object.entries(rules).filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
console.log(JSON.stringify({ fixtureDiagnosticLabels: labels, errorLines: text.split('\n').filter(l => /error|fatal|failed/i.test(l)).length }));
