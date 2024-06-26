# Kibana-Code-Deployer

Kibana Code Deployer is brought to you by your friends at [Last Call Media](https://www.lastcallmedia.com), this package is a command-line tool that can be used to import and export saved Kibana objects to JSON files in a local directory.  These JSON files can be committed to version control.

Usage
-----

You can install this project using a simple command:
```bash
npm i @lastcall/kibana-code-deployer
```

Once you have it installed, create a configuration file in your project root (`kcd.json`).  The config file will contain information about your Kibana installation, as well as a local directory that will be used to store exported objects.
```json
# kcd.json
{
  "kibana": {
    "url": "THE_URL_TO_KIBANA"
  },
  "directory": "LOCAL_DIRECTORY_TO_PUT_EXPORTS_IN",
}
```

Now you're ready to rock!  To see what would be exported by KCD, run the following command:
```bash
node_modules/.bin/kcd compare
```

To export those objects from you Kibana instance to your local directory, run:
```bash
node_modules/.bin/kcd export-all
```

To import those same objects from your local directory to your Kibana instance, run:
```bash
node_modules/.bin/kcd import-all
```
