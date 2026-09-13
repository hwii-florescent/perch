//! Host-owned launcher preferences, shared by every client of this database.
use super::*;

#[derive(Debug, Clone)]
pub struct ProviderPreference {
    pub enabled: bool,
    pub is_default: bool,
}

impl Default for ProviderPreference {
    fn default() -> Self {
        Self {
            enabled: true,
            is_default: false,
        }
    }
}

impl HistoryDb {
    pub fn provider_preferences(
        &self,
    ) -> anyhow::Result<(u64, HashMap<String, ProviderPreference>)> {
        let conn = self.conn.lock().unwrap();
        let revision = conn.query_row(
            "SELECT revision FROM provider_catalog_state WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        let mut stmt =
            conn.prepare("SELECT provider_id, enabled, is_default FROM provider_preferences")?;
        let preferences = stmt
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    ProviderPreference {
                        enabled: row.get(1)?,
                        is_default: row.get(2)?,
                    },
                ))
            })?
            .collect::<Result<HashMap<_, _>, _>>()?;
        Ok((revision, preferences))
    }

    pub fn configure_provider(
        &self,
        provider_id: &str,
        enabled: Option<bool>,
        is_default: Option<bool>,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(
            !provider_id.is_empty() && provider_id.len() <= 128,
            "invalid provider id"
        );
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let current = tx
            .query_row(
                "SELECT enabled, is_default FROM provider_preferences WHERE provider_id = ?1",
                [provider_id],
                |row| {
                    Ok(ProviderPreference {
                        enabled: row.get(0)?,
                        is_default: row.get(1)?,
                    })
                },
            )
            .optional()?
            .unwrap_or_default();
        let enabled = enabled.unwrap_or(current.enabled);
        anyhow::ensure!(
            enabled || is_default != Some(true),
            "disabled agent cannot be the default"
        );
        let is_default = is_default.unwrap_or(current.is_default) && enabled;
        if is_default {
            tx.execute(
                "UPDATE provider_preferences SET is_default = 0 WHERE is_default = 1",
                [],
            )?;
        }
        tx.execute("INSERT INTO provider_preferences(provider_id, enabled, is_default) VALUES (?1, ?2, ?3)
            ON CONFLICT(provider_id) DO UPDATE SET enabled = excluded.enabled, is_default = excluded.is_default",
            params![provider_id, enabled, is_default])?;
        tx.execute(
            "UPDATE provider_catalog_state SET revision = revision + 1 WHERE id = 1",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_persist_and_default_is_unique_and_enabled() {
        let file = std::env::temp_dir().join(format!(
            "perch-provider-preferences-{}.sqlite",
            Uuid::new_v4()
        ));
        let db = HistoryDb::open(&file).unwrap();
        db.configure_provider("pi", None, Some(true)).unwrap();
        db.configure_provider("omp", None, Some(true)).unwrap();
        drop(db);
        let db = HistoryDb::open(&file).unwrap();
        let (revision, preferences) = db.provider_preferences().unwrap();
        assert_eq!(revision, 2);
        assert!(!preferences["pi"].is_default);
        assert!(preferences["omp"].is_default);
        db.configure_provider("omp", Some(false), None).unwrap();
        let (_, preferences) = db.provider_preferences().unwrap();
        assert!(!preferences["omp"].is_default);
        assert!(!preferences["omp"].enabled);
        drop(db);
        std::fs::remove_file(file).unwrap();
    }
}
