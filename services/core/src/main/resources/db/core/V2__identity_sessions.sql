-- Server-side browser sessions (Spring Session JDBC, table name core_session). Each row holds one signed-in
-- browser; the Keycloak tokens are attributes and never leave the server. principal_name is the Keycloak
-- subject, so "sign out everywhere" can find every session of an account.
CREATE TABLE IF NOT EXISTS core_session (
    primary_id            CHAR(36)     NOT NULL,
    session_id            CHAR(36)     NOT NULL,
    creation_time         BIGINT       NOT NULL,
    last_access_time      BIGINT       NOT NULL,
    max_inactive_interval INT          NOT NULL,
    expiry_time           BIGINT       NOT NULL,
    principal_name        VARCHAR(100),
    CONSTRAINT core_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS core_session_ix1 ON core_session (session_id);
CREATE INDEX IF NOT EXISTS core_session_ix2 ON core_session (expiry_time);
CREATE INDEX IF NOT EXISTS core_session_ix3 ON core_session (principal_name);

CREATE TABLE IF NOT EXISTS core_session_attributes (
    session_primary_id CHAR(36)     NOT NULL,
    attribute_name     VARCHAR(200) NOT NULL,
    attribute_bytes    BYTEA        NOT NULL,
    CONSTRAINT core_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT core_session_attributes_fk FOREIGN KEY (session_primary_id) REFERENCES core_session (primary_id) ON DELETE CASCADE
);
