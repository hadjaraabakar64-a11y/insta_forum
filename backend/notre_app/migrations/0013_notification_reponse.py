import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notre_app', '0012_profilutilisateur'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='reponse',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='notre_app.reponse',
            ),
        ),
    ]
