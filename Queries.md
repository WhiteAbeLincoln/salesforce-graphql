# Query Types
## Root-Parent-Parent
### Query
```graphql
Jedi {
  Master {
    Master {
      Id
    }
  }
}
```
### Expected
```sql
  SELECT Master.Master.Id FROM Jedi
```
### Actual
*Works*

```json
  { "Jedi": [{ "Master": { "Master": { "Id": 1 } } }] }
```

## Root-Parent-Child
### Query
```graphql
Jedi {
  Master {
    Padawans {
      Id
    }
  }
}
```
### Expected
```sql
SELECT (SELECT Id FROM Master.Padawans) FROM Jedi
```
### Actual
*Does Not Work*
#### Solution
```sql
  SELECT Master.Id FROM Jedi
```
```json
{ "Jedi": [{ "Master": { "Id": 10 } }] }
```
For every returned `jedi` do
```sql
  SELECT (SELECT Id FROM Padawans) FROM Masters WHERE Master.Id = '${jedi.Master.Id}' 
```
```json
{ "Jedi": [{ "Padawans": [{ "Id": 12, "MasterId": 10 }] }]}
```
## Root-Child-Child
### Query
```graphql
Jedi {
  Padawans {
    Lightsabers {
      Id
    }
  }
}
```
### Expected
```sql
SELECT (SELECT (SELECT Id FROM Lightsabers) FROM Padawans) FROM Jedi
```
### Actual
*Does Not Work*
#### Solution
```sql
SELECT (SELECT Id FROM Padawans) FROM Jedi
```
```json
{ "Jedi": [{ "Padawans": [{ "Id": 10 }] }] }
```
for every `padawan` do
```sql
SELECT (SELECT Id FROM Lightsabers) FROM Padawan WHERE Padawan.Id = '${padawan.Id}'
```
## Root-Child-Parent
### Query
```graphql
Jedi {
  Padawans {
    Master {
      Id
    }
  }
}
```
### Expected
  ```sql
    SELECT (SELECT Master.Id FROM Padawans) FROM Jedi
  ```
### Actual
  *Works*  
  ```json
    { "Jedi": [{ "Padawans": { "Master": { "Id": 10 } } }] }
  ```